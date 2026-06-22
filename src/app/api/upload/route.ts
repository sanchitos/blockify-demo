import { NextResponse } from "next/server";
// Import the lib entrypoint directly to avoid pdf-parse's debug code that
// reads a sample file when imported as the package index.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { processAll } from "@/lib/pipeline";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const f = file as File;
    const isPdf =
      f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 415 }
      );
    }

    // Extract the text layer from the PDF.
    const buffer = Buffer.from(await f.arrayBuffer());
    const parsed = await pdfParse(buffer);
    const text = (parsed.text || "").trim();

    if (!text) {
      return NextResponse.json(
        {
          error:
            "No extractable text found in this PDF. If it's a scanned document, it needs OCR first.",
        },
        { status: 422 }
      );
    }

    const useDistill = (formData.get("useDistill") ?? "true") !== "false";
    const result = await processAll({
      text,
      source: f.name,
      useDistill,
    });

    return NextResponse.json({
      ...result,
      pages: parsed.numpages,
      characters: text.length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error", raw: e?.raw },
      { status: e?.status ?? 500 }
    );
  }
}
