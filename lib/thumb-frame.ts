const cache = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const videoLocks = new Map<string, Promise<void>>();

function cacheKey(videoUrl: string, timeMs: number) {
  return `${videoUrl}#${Math.round(timeMs)}`;
}

async function withVideoLock<T>(videoUrl: string, task: () => Promise<T>) {
  const previous = videoLocks.get(videoUrl) || Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  videoLocks.set(
    videoUrl,
    previous.then(() => gate).catch(() => gate),
  );
  await previous.catch(() => undefined);
  try {
    return await task();
  } finally {
    release();
  }
}

function captureFrame(videoUrl: string, timeMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";

    let settled = false;

    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error instanceof Error ? error : new Error("截取视频帧失败"));
    };

    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      video.removeAttribute("src");
      video.load();
    };

    const onError = () => fail(new Error("视频加载失败"));

    const onSeeked = () => {
      try {
        const width = video.videoWidth || 1280;
        const height = video.videoHeight || 720;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          fail(new Error("无法创建画布"));
          return;
        }
        ctx.drawImage(video, 0, 0, width, height);
        const url = canvas.toDataURL("image/jpeg", 0.82);
        if (!settled) {
          settled = true;
          cleanup();
          resolve(url);
        }
      } catch (error) {
        fail(error);
      }
    };

    const onMeta = () => {
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const target = Math.min(
        Math.max(timeMs / 1000, 0.05),
        duration > 0 ? Math.max(duration - 0.05, 0) : timeMs / 1000,
      );
      try {
        video.currentTime = target;
      } catch (error) {
        fail(error);
      }
    };

    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.src = videoUrl;
    video.load();
  });
}

export async function getThumbFrame(videoUrl: string, timeMs: number) {
  const key = cacheKey(videoUrl, timeMs);
  const hit = cache.get(key);
  if (hit) return hit;

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = withVideoLock(videoUrl, () => captureFrame(videoUrl, timeMs))
    .then((url) => {
      cache.set(key, url);
      inflight.delete(key);
      return url;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, task);
  return task;
}
