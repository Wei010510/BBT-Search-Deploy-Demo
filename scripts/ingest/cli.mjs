import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { parseSrt } from "./parseSrt.mjs";
import { alignSubtitles } from "./align.mjs";
import { insertEpisode, insertSubtitleLines } from "./db.mjs";
import { createR2Client, uploadVideo } from "./storage.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");

async function loadEnv() {
  const envPath = path.join(root, ".env.local");
  const text = await readFile(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const i = trimmed.indexOf("=");
    if (i < 0) continue;
    const key = trimmed.slice(0, i).trim();
    const value = trimmed.slice(i + 1).trim();
    if (!(key in process.env) || !process.env[key]) process.env[key] = value;
  }
}

function findZhPath(subDir, base) {
  return [`${base}.zh.srt`, `${base}.cn.srt`].map((name) =>
    path.join(subDir, name),
  );
}

async function exists(filePath) {
  try {
    await readFile(filePath);
    return true;
  } catch {
    return false;
  }
}

async function processEpisode(supabase, r2, bucket, base) {
  const videoPath = path.join(root, "data/raw/videos", `${base}.mp4`);
  const enPath = path.join(root, "data/raw/subtitles", `${base}.en.srt`);
  const zhCandidates = findZhPath(path.join(root, "data/raw/subtitles"), base);

  const missing = [];
  if (!(await exists(videoPath))) missing.push(`${base}.mp4`);
  if (!(await exists(enPath))) missing.push(`${base}.en.srt`);

  let zhPath = null;
  for (const candidate of zhCandidates) {
    if (await exists(candidate)) {
      zhPath = candidate;
      break;
    }
  }
  if (!zhPath) missing.push(`${base}.zh.srt 或 ${base}.cn.srt`);

  if (missing.length) {
    return { status: "skip", base, reason: `缺文件: ${missing.join(", ")}` };
  }

  const enCues = parseSrt(await readFile(enPath, "utf8"));
  const zhCues = parseSrt(await readFile(zhPath, "utf8"));
  const lines = alignSubtitles(enCues, zhCues);

  const objectKey = `videos/${base}.mp4`;
  await uploadVideo(r2, bucket, objectKey, videoPath);

  const match = base.match(/^s(\d+)e(\d+)$/i);
  if (!match) throw new Error(`文件名不符合 s01e01: ${base}`);
  const season = Number(match[1]);
  const episode = Number(match[2]);

  const episodeId = await insertEpisode(supabase, {
    season,
    episode,
    title: null,
    video_object_key: objectKey,
    duration_ms: null,
  });

  const count = await insertSubtitleLines(supabase, episodeId, lines);

  const processed = {
    episode: {
      season,
      episode,
      title: null,
      video_key: objectKey,
    },
    lines,
  };

  const outDir = path.join(root, "data/processed");
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, `${base}.json`),
    JSON.stringify(processed, null, 2),
    "utf8",
  );

  return { status: "ok", base, lines: count, objectKey };
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.R2_BUCKET;

  if (!bucket) {
    throw new Error(".env.local 缺少 R2_BUCKET");
  }

  if (!url || !key) {
    throw new Error(
      ".env.local 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const r2 = createR2Client();

  const videoNames = await readdir(path.join(root, "data/raw/videos"));
  const bases = videoNames
    .filter((name) => name.toLowerCase().endsWith(".mp4"))
    .map((name) => name.replace(/\.mp4$/i, "").toLowerCase())
    .sort();

  if (!bases.length) {
    throw new Error("data/raw/videos 里没有 mp4");
  }

  const report = [];
  for (const base of bases) {
    try {
      const result = await processEpisode(supabase, r2, bucket, base);
      report.push(result);
      console.log(result);
    } catch (error) {
      const failed = { status: "fail", base, reason: error.message };
      report.push(failed);
      console.error(failed);
    }
  }

  const ok = report.filter((item) => item.status === "ok").length;
  const skip = report.filter((item) => item.status === "skip").length;
  const fail = report.filter((item) => item.status === "fail").length;
  console.log(`完成: 成功 ${ok}, 跳过 ${skip}, 失败 ${fail}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
