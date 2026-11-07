function overlapMs(a, b) {
  return Math.max(0, Math.min(a.end_ms, b.end_ms) - Math.max(a.start_ms, b.start_ms));
}

export function alignSubtitles(enCues, zhCues) {
  return enCues.map((en) => {
    const enLen = en.end_ms - en.start_ms;
    const matched = zhCues
      .filter((zh) => {
        const overlap = overlapMs(en, zh);
        const zhLen = zh.end_ms - zh.start_ms;
        const shorter = Math.min(enLen, zhLen);
        return shorter > 0 && overlap >= shorter * 0.4;
      })
      .sort((a, b) => a.start_ms - b.start_ms);

    return {
      start_ms: en.start_ms,
      end_ms: en.end_ms,
      en_text: en.text,
      zh_text: matched.map((item) => item.text).join(" ") || null,
    };
  });
}
