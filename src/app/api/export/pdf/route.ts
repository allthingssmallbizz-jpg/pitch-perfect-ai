import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
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

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 54;
  let y = 60;
  const lineHeight = 14;
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = doc.internal.pageSize.getWidth() - marginX * 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(label, marginX, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);

  const paragraphs = generation.content.split("\n");
  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph || " ", maxWidth);
    for (const line of lines) {
      if (y > pageHeight - 60) {
        doc.addPage();
        y = 60;
      }
      doc.text(line, marginX, y);
      y += lineHeight;
    }
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${label.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
