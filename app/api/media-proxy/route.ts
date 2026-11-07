import { NextRequest, NextResponse } from "next/server";

function isAllowedUrl(raw: string) {
  try {
    const parsed = new URL(raw);
    const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    if (supabase) {
      const origin = new URL(supabase).origin;
      if (
        parsed.origin === origin &&
        parsed.pathname.includes("/storage/v1/object/public/thumbnails/")
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const url = (request.nextUrl.searchParams.get("url") || "").trim();
  if (!url || !isAllowedUrl(url)) {
    return NextResponse.json({ error: "非法资源地址" }, { status: 400 });
  }

  try {
    const upstream = await fetch(url, { cache: "force-cache" });
    if (!upstream.ok) {
      return NextResponse.json({ error: "资源读取失败" }, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const body = await upstream.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "资源代理失败" }, { status: 500 });
  }
}
