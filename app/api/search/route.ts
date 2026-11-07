import { NextRequest, NextResponse } from "next/server";
import { searchClips } from "@/lib/query-clips";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const limitRaw = Number(request.nextUrl.searchParams.get("limit") || "50");
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 50);

  if (!q) {
    return NextResponse.json({ error: "缺少搜索词" }, { status: 400 });
  }
  if (q.length > 40) {
    return NextResponse.json({ error: "搜索词过长" }, { status: 400 });
  }

  try {
    const results = await searchClips(q, limit);
    return NextResponse.json({ query: q, results });
  } catch {
    return NextResponse.json({ error: "搜索没有完成" }, { status: 500 });
  }
}
