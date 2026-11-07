"use client";

import { useEffect, useState } from "react";
import { getThumbFrame } from "@/lib/thumb-frame";

type Props = {
  videoUrl: string;
  timeMs: number;
  className?: string;
};

export function VideoPoster({ videoUrl, timeMs, className = "" }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);

    getThumbFrame(videoUrl, timeMs)
      .then((url) => {
        if (alive) setSrc(url);
      })
      .catch(() => {
        if (alive) {
          setSrc(null);
          setFailed(true);
        }
      });

    return () => {
      alive = false;
    };
  }, [videoUrl, timeMs]);

  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`h-full w-full object-cover ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <div
      className={`h-full w-full bg-gradient-to-br from-[#2a2a32] via-[#3d4a45] to-[#1c1c22] ${className}`}
      aria-hidden
    >
      {!failed ? (
        <div className="flex h-full items-center justify-center">
          <span className="h-8 w-8 animate-pulse rounded-full bg-white/15" />
        </div>
      ) : null}
    </div>
  );
}
