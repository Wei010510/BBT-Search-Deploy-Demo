"use client";

import { useEffect, useRef, useState } from "react";
import type { Clip } from "@/lib/types";
import { episodeLabel, formatTime } from "@/lib/format";
import {
  captureSubtitleFrame,
  downloadBlob,
} from "@/lib/capture-subtitle-frame";

type Props = {
  clips: Clip[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
};

export function ClipModal({ clips, index, onClose, onIndexChange }: Props) {
  const clip = clips[index];
  const videoRef = useRef<HTMLVideoElement>(null);
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const [shotState, setShotState] = useState<"idle" | "busy" | "error">("idle");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (event.key === "ArrowRight" && index < clips.length - 1) {
        onIndexChange(index + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clips.length, index, onClose, onIndexChange]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip) return;

    const offset = (clip.timeline_offset_ms || 0) / 1000;
    const start = clip.start_ms / 1000 + offset;
    const end = clip.end_ms / 1000 + offset;
    setCopyState("idle");
    setShotState("idle");
    setActionError("");

    const onTimeUpdate = () => {
      if (video.currentTime >= end) {
        video.pause();
        video.currentTime = end;
      }
    };

    const ready = () => {
      video.currentTime = start;
    };

    video.addEventListener("loadedmetadata", ready);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.src = clip.video_url;
    video.load();

    return () => {
      video.removeEventListener("loadedmetadata", ready);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [clip]);

  if (!clip) return null;

  const playClip = async () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime =
      clip.start_ms / 1000 + (clip.timeline_offset_ms || 0) / 1000;
    await video.play();
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/?clip=${encodeURIComponent(clip.line_id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("done");
      setActionError("");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("error");
      setActionError("复制失败，请检查浏览器剪贴板权限");
    }
  };

  const takeScreenshot = async () => {
    if (shotState === "busy") return;
    setShotState("busy");
    setActionError("");

    try {
      const blob = await captureSubtitleFrame(clip);
      const name = `tbbt-s${String(clip.season).padStart(2, "0")}e${String(clip.episode).padStart(2, "0")}-${formatTime(clip.start_ms).replace(":", "-")}.png`;
      downloadBlob(blob, name);
      setShotState("idle");
    } catch (error) {
      setShotState("error");
      setActionError(
        error instanceof Error ? error.message : "截图失败，请稍后重试",
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-black/50 px-3 py-1 text-sm text-white"
        >
          关闭
        </button>

        <div className="bg-black">
          <video
            ref={videoRef}
            className="aspect-video w-full"
            controls
            playsInline
          />
        </div>

        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between text-xs tracking-[0.16em] text-[var(--muted)] uppercase">
            <span>{episodeLabel(clip.season, clip.episode)}</span>
            <span>
              {formatTime(clip.start_ms)} – {formatTime(clip.end_ms)}
            </span>
          </div>

          <p className="font-['Microsoft_YaHei','微软雅黑',sans-serif] text-base leading-relaxed">
            {clip.en_text}
          </p>
          {clip.zh_text ? (
            <p className="font-['Microsoft_YaHei','微软雅黑',sans-serif] text-base leading-relaxed text-[var(--muted)]">
              {clip.zh_text}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={playClip}
              className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm text-white"
            >
              播放这段切片
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm"
            >
              {copyState === "done" ? "已复制链接" : "复制链接"}
            </button>
            <button
              type="button"
              onClick={takeScreenshot}
              disabled={shotState === "busy" || !clip.thumbnail_url}
              className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {shotState === "busy" ? "截图中…" : "下载截图"}
            </button>
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => onIndexChange(index - 1)}
              className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm disabled:opacity-30"
            >
              ← 上一段
            </button>
            <button
              type="button"
              disabled={index >= clips.length - 1}
              onClick={() => onIndexChange(index + 1)}
              className="rounded-full border border-[var(--line)] px-4 py-2.5 text-sm disabled:opacity-30"
            >
              下一段 →
            </button>
            <span className="ml-auto text-sm text-[var(--muted)]">
              {index + 1} / {clips.length}
            </span>
          </div>

          {actionError ? (
            <p className="text-sm text-red-600">{actionError}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
