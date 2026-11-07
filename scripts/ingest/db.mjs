export async function insertEpisode(supabase, episode) {
  const { data, error } = await supabase
    .from("episodes")
    .upsert(episode, { onConflict: "season,episode" })
    .select("id")
    .single();

  if (error) throw new Error(`insertEpisode: ${error.message}`);
  return data.id;
}

export async function insertSubtitleLines(supabase, episodeId, lines) {
  const { error: delError } = await supabase
    .from("subtitle_lines")
    .delete()
    .eq("episode_id", episodeId);
  if (delError) throw new Error(`clear lines: ${delError.message}`);

  if (!lines.length) return 0;

  const rows = lines.map((line) => ({
    episode_id: episodeId,
    start_ms: line.start_ms,
    end_ms: line.end_ms,
    en_text: line.en_text,
    zh_text: line.zh_text,
  }));

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("subtitle_lines").insert(chunk);
    if (error) throw new Error(`insertSubtitleLines: ${error.message}`);
  }

  return rows.length;
}
