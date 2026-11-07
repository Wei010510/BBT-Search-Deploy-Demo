import { NextResponse } from "next/server";
import { randomClips } from "@/lib/query-clips";

export async function GET() {
  try {
    const results = await randomClips(9);
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "加载没有完成" }, { status: 500 });
  }
}
