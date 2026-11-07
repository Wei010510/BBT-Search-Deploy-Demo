import type { Clip } from "./types";
import { INTRO_OFFSET_MS } from "./timeline-offset";

type Row = {
  id: string;
  start_ms: number;
  end_ms: number;
  en_text: string | null;
  zh_text: string | null;
  thumbnail_url?: string | null;
  episodes:
    | {
        id: string;
        season: number;
        episode: number;
        title: string | null;
        video_object_key: string;
      }
    | {
        id: string;
        season: number;
        episode: number;
        title: string | null;
        video_object_key: string;
      }[]
    | null;
};

export function videoUrl(objectKey: string) {
  const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("缺少 R2_PUBLIC_BASE_URL");
  return `${base}/${objectKey}`;
}

export function mapRow(row: Row): Clip | null {
  const episode = Array.isArray(row.episodes) ? row.episodes[0] : row.episodes;
  if (!episode) return null;
  return {
    line_id: row.id,
    episode_id: episode.id,
    season: episode.season,
    episode: episode.episode,
    title: episode.title,
    start_ms: row.start_ms,
    end_ms: row.end_ms,
    timeline_offset_ms: INTRO_OFFSET_MS,
    en_text: row.en_text,
    zh_text: row.zh_text,
    video_url: videoUrl(episode.video_object_key),
    thumbnail_url: row.thumbnail_url || null,
  };
}

export const clipSelect = `
  id,
  start_ms,
  end_ms,
  en_text,
  zh_text,
  thumbnail_url,
  episodes (
    id,
    season,
    episode,
    title,
    video_object_key
  )
`;
