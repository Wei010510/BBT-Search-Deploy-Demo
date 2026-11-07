import { cleanText } from "./cleanText.mjs";

function toMs(stamp) {
  const m = stamp.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/);
  if (!m) return null;
  const [, hh, mm, ss, ms] = m;
  return (
    Number(hh) * 3600000 +
    Number(mm) * 60000 +
    Number(ss) * 1000 +
    Number(ms.padEnd(3, "0").slice(0, 3))
  );
}

export function parseSrt(content) {
  const blocks = content.replace(/^\uFEFF/, "").trim().split(/\n\s*\n/);
  const cues = [];

  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) continue;

    const timeLine = lines.find((line) => line.includes("-->"));
    if (!timeLine) continue;

    const [startRaw, endRaw] = timeLine.split("-->");
    const start_ms = toMs(startRaw);
    const end_ms = toMs(endRaw);
    if (start_ms == null || end_ms == null || end_ms <= start_ms) continue;

    const textLines = lines.slice(lines.indexOf(timeLine) + 1);
    const text = cleanText(textLines.join(" "));
    if (!text) continue;

    cues.push({ start_ms, end_ms, text });
  }

  return cues;
}
