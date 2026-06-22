import { NextResponse } from "next/server";
import { processAll } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { text, source, useDistill = true } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const result = await processAll({ text, source, useDistill });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error", raw: e?.raw },
      { status: e?.status ?? 500 }
    );
  }
}
