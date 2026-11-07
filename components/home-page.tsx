"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Clip } from "@/lib/types";
import { ClipCard } from "./clip-card";
import { ClipModal } from "./clip-modal";

const examples = ["Raj", "Sheldon", "pizza", "bazinga"];

type Props = {
  initialClips: Clip[];
  initialQuery?: string;
  initialClipId?: string;
};

export function HomePage({
  initialClips,
  initialQuery = "",
  initialClipId = "",
}: Props) {
  const [value, setValue] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [clips, setClips] = useState<Clip[]>(initialClips);
  const [mode, setMode] = useState<"random" | "search">(
    initialQuery ? "search" : initialClipId ? "search" : "random",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState<number | null>(
    initialClipId ? 0 : null,
  );
  const skipFirstFetch = useRef(true);
  const preserveClipUrl = useRef(Boolean(initialClipId));
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = value.trim();
      setQuery(next);
      if (next) {
        preserveClipUrl.current = false;
        window.history.replaceState({}, "", `/?q=${encodeURIComponent(next)}`);
        return;
      }
      if (preserveClipUrl.current && initialClipId) {
        preserveClipUrl.current = false;
        return;
      }
      window.history.replaceState({}, "", "/");
    }, 280);
    return () => window.clearTimeout(timer);
  }, [value, initialClipId]);

  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }

    let alive = true;

    async function load() {
      setLoading(true);
      setError("");
      setActiveIndex(null);

      try {
        if (query) {
          const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "搜索没有完成");
          if (!alive) return;
          setClips(data.results || []);
          setMode("search");
        } else {
          const res = await fetch(`/api/random?t=${Date.now()}`);
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "加载没有完成");
          if (!alive) return;
          setClips(data.results || []);
          setMode("random");
        }
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "加载没有完成");
        setClips([]);
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [query, refreshTick]);

  useEffect(() => {
    const onPopState = () => {
      const q = new URLSearchParams(window.location.search).get("q") || "";
      setValue(q);
      setQuery(q);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(value.trim());
  };

  const refreshRandom = () => {
    setValue("");
    window.history.replaceState({}, "", "/");
    skipFirstFetch.current = false;
    if (query) {
      setQuery("");
    } else {
      setRefreshTick((n) => n + 1);
    }
  };

  return (
    <main className="relative mx-auto min-h-screen w-full max-w-6xl px-6 pb-20 pt-16">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="title-art font-[family-name:var(--font-display)] text-5xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
          The Big Bang Theory
        </h1>
        <p className="mx-auto mt-6 max-w-xl font-[family-name:var(--font-display)] text-xl italic leading-relaxed text-[#667] sm:text-2xl">
          “I’m not crazy. My mother had me tested.”
        </p>

        <form onSubmit={onSubmit} className="mt-10">
          <label className="sr-only" htmlFor="q">
            搜索台词
          </label>
          <input
            id="q"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="搜索一句台词，中英文都可以"
            className="w-full rounded-full border border-[#d9d9e0] bg-white px-6 py-4 text-base text-[#1a1a1c] outline-none shadow-[0_10px_30px_rgba(20,20,30,0.04)] placeholder:text-[#8a8a93] focus:border-[#2f5d50]"
          />
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className="mr-1 text-sm text-[#6b6b73]">您可以试试</span>
          {examples.map((word) => (
            <button
              key={word}
              type="button"
              onClick={() => setValue(word)}
              className="rounded-full border border-[#d0d0d8] bg-white px-3 py-1.5 text-sm font-medium text-[#33333a] transition hover:-translate-y-0.5 hover:border-[#2f5d50] hover:bg-[#f3faf7] hover:text-[#2f5d50] hover:shadow-md"
            >
              {word}
            </button>
          ))}
        </div>
      </header>

      <section className="mt-14">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-sm tracking-[0.2em] text-[#6b6b73] uppercase">
              {mode === "search" ? "Search Results" : "Random Cuts"}
            </h2>
            <p className="mt-1 text-sm text-[#6b6b73]">
              {mode === "search"
                ? query
                  ? `与 “${query}” 相关的切片`
                  : "分享的台词切片"
                : "每次刷新都会换一批切片"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {loading ? <span className="text-sm text-[#6b6b73]">加载中…</span> : null}
            <button
              type="button"
              onClick={refreshRandom}
              className="rounded-full border border-[#d0d0d8] bg-white px-4 py-1.5 text-sm text-[#33333a] transition hover:border-[#2f5d50] hover:text-[#2f5d50]"
            >
              刷新推荐
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {!loading && !error && clips.length === 0 ? (
          <div className="rounded-2xl border border-[#d9d9e0] bg-white px-4 py-10 text-center text-[#6b6b73]">
            没有找到这句台词
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clips.map((clip, index) => (
            <ClipCard
              key={`${clip.line_id}-${index}-${refreshTick}`}
              clip={clip}
              onOpen={() => setActiveIndex(index)}
            />
          ))}
        </div>
      </section>

      {activeIndex !== null ? (
        <ClipModal
          clips={clips}
          index={activeIndex}
          onClose={() => setActiveIndex(null)}
          onIndexChange={setActiveIndex}
        />
      ) : null}
    </main>
  );
}
