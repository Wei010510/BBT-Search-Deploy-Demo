import type { Clip } from "@/lib/types";
import { episodeLabel, formatTime } from "@/lib/format";

type Props = {
  clip: Clip;
  onOpen: () => void;
};

export function ClipCard({ clip, onOpen }: Props) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl text-left shadow-[0_12px_32px_rgba(20,20,30,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(20,20,30,0.18)]"
    >
      <div className="absolute inset-0 bg-[#2a2a32]">
        {clip.thumbnail_url ? (
          <img
            src={clip.thumbnail_url}
            alt=""
            className="h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-[#2a2a32] via-[#3d4a45] to-[#1c1c22]" />
        )}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/45 to-black/15" />

      <div className="relative z-10 flex h-full min-h-[240px] flex-col p-5">
        <div className="flex items-center justify-between text-xs tracking-[0.16em] text-white/70 uppercase">
          <span>{episodeLabel(clip.season, clip.episode)}</span>
          <span>{formatTime(clip.start_ms)}</span>
        </div>

        <div className="mt-auto pt-10">
          <p className="font-['Microsoft_YaHei','微软雅黑',sans-serif] text-sm leading-relaxed text-white">
            {clip.en_text || "—"}
          </p>
          {clip.zh_text ? (
            <p className="mt-2 line-clamp-3 font-['Microsoft_YaHei','微软雅黑',sans-serif] text-sm leading-relaxed text-white/75">
              {clip.zh_text}
            </p>
          ) : null}
          <span className="mt-4 inline-block text-sm text-[#9fdfc8] opacity-0 transition group-hover:opacity-100">
            查看片段 →
          </span>
        </div>
      </div>
    </button>
  );
}
