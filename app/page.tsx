import { HomePage } from "@/components/home-page";
import { getClipById, randomClips, searchClips } from "@/lib/query-clips";
import type { Clip } from "@/lib/types";

type Props = {
  searchParams: Promise<{ q?: string; clip?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const q = (params.q || "").trim();
  const clipId = (params.clip || "").trim();

  let initialClips: Clip[] = [];
  let initialClipId = "";

  try {
    if (clipId) {
      const clip = await getClipById(clipId);
      if (clip) {
        initialClips = [clip];
        initialClipId = clip.line_id;
      } else {
        initialClips = q ? await searchClips(q, 50) : await randomClips(9);
      }
    } else {
      initialClips = q ? await searchClips(q, 50) : await randomClips(9);
    }
  } catch {
    initialClips = [];
  }

  return (
    <HomePage
      initialClips={initialClips}
      initialQuery={q}
      initialClipId={initialClipId}
    />
  );
}
