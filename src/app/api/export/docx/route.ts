import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { getAssetLabel } from "@/lib/ai/assetLabels";
import { getOwnedGeneration } from "@/lib/generations";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const generationId = req.nextUrl.searchParams.get("generationId");
  if (!generationId) return NextResponse.json({ error: "Missing generationId" }, { status: 400 });

  const owned = await getOwnedGeneration(generationId);
  if ("error" in owned) return NextResponse.json({ error: owned.error }, { status: owned.status });
  const { generation } = owned;

  if (!generation.content) {
    return NextResponse.json({ error: "Nothing to export yet." }, { status: 400 });
  }

  const label = getAssetLabel(generation.asset_type);

  const doc = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: label, heading: HeadingLevel.HEADING_1 }),
          ...generation.content.split("\n").map(
            (line: string) =>
              new Paragraph({
                text: line,
                heading: line.startsWith("#") ? HeadingLevel.HEADING_2 : undefined,
              })
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${label.replace(/\s+/g, "-").toLowerCase()}.docx"`,
    },
  });
}
