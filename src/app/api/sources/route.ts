import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await getSupabaseAdmin()
    .from("ideablocks")
    .select("source")
    .not("source", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sources = Array.from(
    new Set((data ?? []).map((r: any) => r.source).filter(Boolean))
  ).sort();

  return NextResponse.json({ sources });
}
