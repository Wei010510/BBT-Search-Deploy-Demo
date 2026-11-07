/**
 * 从本地整集视频按台词时间截帧，上传到 Supabase Storage 的 thumbnails 桶，
 * 并回写 subtitle_lines.thumbnail_url。
 */
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const BUCKET = "thumbnails";
/** 与 lib/timeline-offset.ts 保持一致：片头水印 4 秒 */
const INTRO_OFFSET_MS = 4000;

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

function msToFfmpegTime(ms) {
  const totalMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("未找到 ffmpeg-static 二进制"));
      return;
    }
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg 失败: ${stderr.slice(-400)}`));
    });
  });
}

async function extractThumb(videoPath, timeMs, outPath) {
  const stamp = msToFfmpegTime(timeMs + 120);
  await runFfmpeg([
    "-y",
    "-ss",
    stamp,
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-q:v",
    "3",
    outPath,
  ]);
}

function episodeBase(season, episode) {
  return `s${String(season).padStart(2, "0")}e${String(episode).padStart(2, "0")}`;
}

async function main() {
  await loadEnv();

  if (!ffmpegPath) throw new Error("ffmpeg-static 未安装");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(".env.local 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: lines, error } = await supabase
    .from("subtitle_lines")
    .select(
      `
      id,
      start_ms,
      thumbnail_url,
      episodes (
        season,
        episode,
        video_object_key
      )
    `,
    )
    .order("start_ms", { ascending: true });

  if (error) {
    throw new Error(
      `读取台词失败（请确认已执行 ALTER TABLE 增加 thumbnail_url）: ${error.message}`,
    );
  }

  const rows = (lines || []).filter((row) => {
    const ep = Array.isArray(row.episodes) ? row.episodes[0] : row.episodes;
    return Boolean(ep);
  });

  if (!rows.length) {
    throw new Error("数据库里没有台词，请先 npm run ingest");
  }

  console.log(`准备生成缩略图：共 ${rows.length} 条`);
  console.log(`ffmpeg: ${ffmpegPath}`);

  const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "tbbt-thumbs-"));
  let ok = 0;
  let fail = 0;

  try {
    for (const row of rows) {
      const ep = Array.isArray(row.episodes) ? row.episodes[0] : row.episodes;
      const base = episodeBase(ep.season, ep.episode);
      const videoPath = path.join(root, "data/raw/videos", `${base}.mp4`);
      const objectPath = `${base}/${row.id}.jpg`;
      const localPath = path.join(tmpRoot, `${row.id}.jpg`);

      try {
        await extractThumb(videoPath, row.start_ms + INTRO_OFFSET_MS, localPath);
        const jpeg = await readFile(localPath);

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(objectPath, jpeg, {
            upsert: true,
            contentType: "image/jpeg",
            cacheControl: "31536000",
          });
        if (uploadError) throw new Error(uploadError.message);

        const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
        const thumbnailUrl = pub.publicUrl;

        const { error: updateError } = await supabase
          .from("subtitle_lines")
          .update({ thumbnail_url: thumbnailUrl })
          .eq("id", row.id);
        if (updateError) throw new Error(updateError.message);

        ok += 1;
        if (ok % 25 === 0 || ok === rows.length) {
          console.log(`进度 ${ok}/${rows.length}`);
        }
      } catch (err) {
        fail += 1;
        console.error(`失败 ${base} ${row.id}:`, err.message || err);
      }
    }
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }

  console.log(`完成: 成功 ${ok}, 失败 ${fail}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
