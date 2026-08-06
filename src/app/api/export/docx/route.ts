import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, HeadingLevel } from "docx";
import { createClient } from "@/lib/supabase/server";
import { ASSET_GENERATORS } from "@/lib/ai/generators";
import type { AssetType } from "@/types/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const generationId = req.nextUrl.searchParams.get("generationId");
  if (!generationId) return NextResponse.json({ error: "Missing generationId" }, { status: 400 });

  const { data: generation } = await supabase
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .eq("user_id", user.id)
    .single();

  if (!generation || !generation.content) {
    return NextResponse.json({ error: "Generation not found" }, { status: 404 });
  }

  const label = ASSET_GENERATORS[generation.asset_type as AssetType].label;

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
