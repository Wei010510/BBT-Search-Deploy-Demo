import { NextRequest, NextResponse } from "next/server";
import { getClipById } from "@/lib/query-clips";

export async function GET(request: NextRequest) {
  const id = (request.nextUrl.searchParams.get("id") || "").trim();

  if (!id) {
    return NextResponse.json({ error: "缺少台词 id" }, { status: 400 });
  }

  try {
    const clip = await getClipById(id);
    if (!clip) {
      return NextResponse.json({ error: "找不到这条台词" }, { status: 404 });
    }
    return NextResponse.json({ result: clip });
  } catch {
    return NextResponse.json({ error: "加载没有完成" }, { status: 500 });
  }
}
