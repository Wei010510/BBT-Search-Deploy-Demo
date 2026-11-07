/** 下载站片头水印时长（秒级统一偏移） */
export const INTRO_OFFSET_MS = 4000;

export function mediaTimeMs(subtitleMs: number, offsetMs = INTRO_OFFSET_MS) {
  return Math.max(0, subtitleMs + offsetMs);
}
