/**
 * 探测片头水印结束点（ms）：黑底 logo 帧 → 正片帧。
 * 在 [0, maxMs] 内按步长扫描，再在边界附近二分到 1ms。
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ffmpegPath = require("ffmpeg-static");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function msToStamp(ms) {
  const totalMs = Math.max(0, Math.round(ms));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const millis = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function grabRgbFrame(videoPath, timeMs) {
  return new Promise((resolve, reject) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "error",
      "-ss",
      msToStamp(timeMs),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-s",
      "160x90",
      "pipe:1",
    ];
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    const chunks = [];
    let stderr = "";
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `ffmpeg exit ${code}`));
        return;
      }
      resolve(Buffer.concat(chunks));
    });
  });
}

function frameStats(buf) {
  if (!buf.length) return { mean: 0, stdev: 0, darkRatio: 1 };
  let sum = 0;
  let sumSq = 0;
  let dark = 0;
  const n = buf.length;
  for (let i = 0; i < n; i += 1) {
    const v = buf[i];
    sum += v;
    sumSq += v * v;
    if (v < 40) dark += 1;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  const stdev = Math.sqrt(Math.max(0, variance));
  return { mean, stdev, darkRatio: dark / n };
}

/** 水印帧：很暗 + 方差不大；正片：更亮或细节更多 */
function isSplash(stats) {
  return stats.darkRatio > 0.82 && stats.mean < 45 && stats.stdev < 55;
}

async function detectOffset(videoPath, maxMs = 12000) {
  const step = 50;
  let lastSplash = 0;
  let firstContent = null;

  for (let t = 0; t <= maxMs; t += step) {
    const stats = frameStats(await grabRgbFrame(videoPath, t));
    const splash = isSplash(stats);
    // console.log(t, splash, stats);
    if (splash) lastSplash = t;
    else if (firstContent == null) {
      firstContent = t;
      break;
    }
  }

  if (firstContent == null) {
    throw new Error(`未在 ${maxMs}ms 内找到正片起点: ${videoPath}`);
  }

  // 在 (lastSplash, firstContent] 内二分，找到第一个非水印帧
  let lo = lastSplash;
  let hi = firstContent;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    const splash = isSplash(frameStats(await grabRgbFrame(videoPath, mid)));
    if (splash) lo = mid;
    else hi = mid;
  }

  return hi;
}

async function main() {
  const bases = ["s01e01", "s01e02"];
  for (const base of bases) {
    const videoPath = path.join(root, "data/raw/videos", `${base}.mp4`);
    const offsetMs = await detectOffset(videoPath);
    console.log(
      JSON.stringify({
        episode: base,
        timeline_offset_ms: offsetMs,
        human: `${(offsetMs / 1000).toFixed(3)}s`,
      }),
    );
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
