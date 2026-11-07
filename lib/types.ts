export type Clip = {
  line_id: string;
  episode_id: string;
  season: number;
  episode: number;
  title: string | null;
  start_ms: number;
  end_ms: number;
  /** 片头水印导致的播放偏移（字幕时间 + offset = 视频时间） */
  timeline_offset_ms: number;
  en_text: string | null;
  zh_text: string | null;
  video_url: string;
  thumbnail_url: string | null;
};
