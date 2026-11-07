import { clipSelect, mapRow } from "./clips";
import { getSupabaseAdmin } from "./supabase";
import type { Clip } from "./types";

export async function getClipById(id: string): Promise<Clip | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subtitle_lines")
    .select(clipSelect)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapRow(data as never);
}

export async function searchClips(q: string, limit = 50): Promise<Clip[]> {
  const supabase = getSupabaseAdmin();
  const safe = q.replace(/[%_,]/g, " ").trim();
  if (!safe) return [];

  const { data, error } = await supabase
    .from("subtitle_lines")
    .select(clipSelect)
    .or(
      `en_text.ilike.%${safe}%,zh_text.ilike.%${safe}%,search_text.ilike.%${safe}%`,
    )
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data || [])
    .map((row) => mapRow(row as never))
    .filter((item): item is Clip => Boolean(item))
    .sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      if (a.episode !== b.episode) return a.episode - b.episode;
      return a.start_ms - b.start_ms;
    });
}

export async function randomClips(count = 9): Promise<Clip[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("subtitle_lines")
    .select(clipSelect)
    .limit(80);

  if (error) throw new Error(error.message);

  const clips = (data || [])
    .map((row) => mapRow(row as never))
    .filter((item): item is Clip => Boolean(item));

  for (let i = clips.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [clips[i], clips[j]] = [clips[j], clips[i]];
  }

  return clips.slice(0, count);
}
