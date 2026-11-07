import type { Clip } from "./types";

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const hasSpace = /\s/.test(text);
  const units = hasSpace ? words : Array.from(text);
  const joiner = hasSpace ? " " : "";
  const lines: string[] = [];
  let current = "";

  for (const unit of units) {
    const next = current ? `${current}${joiner}${unit}` : unit;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = unit;
  }
  if (current) lines.push(current);
  return lines;
}

function drawSubtitles(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  width: number,
  height: number,
) {
  const en = (clip.en_text || "").trim();
  const zh = (clip.zh_text || "").trim();
  if (!en && !zh) return;

  const padX = Math.round(width * 0.05);
  const maxTextWidth = width - padX * 2;
  const enSize = Math.max(22, Math.round(width * 0.028));
  const zhSize = Math.max(20, Math.round(width * 0.024));
  const lineGap = Math.round(enSize * 0.35);

  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.lineJoin = "round";

  const blocks: { text: string; size: number }[] = [];
  if (en) blocks.push({ text: en, size: enSize });
  if (zh) blocks.push({ text: zh, size: zhSize });

  const allLines: { text: string; size: number }[] = [];
  for (const block of blocks) {
    ctx.font = `600 ${block.size}px "Microsoft YaHei", "微软雅黑", sans-serif`;
    for (const line of wrapText(ctx, block.text, maxTextWidth)) {
      allLines.push({ text: line, size: block.size });
    }
  }

  const blockHeight =
    allLines.reduce((sum, line) => sum + line.size + lineGap, 0) +
    Math.round(height * 0.03);
  const barTop = height - blockHeight - Math.round(height * 0.04);

  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, barTop, width, height - barTop);

  let y = height - Math.round(height * 0.045);
  for (let i = allLines.length - 1; i >= 0; i -= 1) {
    const line = allLines[i];
    ctx.font = `600 ${line.size}px "Microsoft YaHei", "微软雅黑", sans-serif`;
    ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
    ctx.lineWidth = Math.max(3, Math.round(line.size * 0.12));
    ctx.strokeText(line.text, width / 2, y);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(line.text, width / 2, y);
    y -= line.size + lineGap;
  }
}

export async function captureSubtitleFrame(clip: Clip): Promise<Blob> {
  if (!clip.thumbnail_url) {
    throw new Error("这条台词还没有截图素材");
  }

  const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(clip.thumbnail_url)}`;
  const res = await fetch(proxyUrl);
  if (!res.ok) throw new Error("读取截图素材失败");

  const blob = await res.blob();
  const bitmap = await createImageBitmap(blob);
  const width = bitmap.width || 1280;
  const height = bitmap.height || 720;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("无法创建画布");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  drawSubtitles(ctx, clip, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((result) => {
      if (!result) {
        reject(new Error("截图导出失败"));
        return;
      }
      resolve(result);
    }, "image/png");
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
