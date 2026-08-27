import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { upsertGhlContact } from "@/lib/integrations/ghl";

export const runtime = "nodejs";

const MISSING_DETAILS_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>Missing details</title></head>
<body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;padding:60px;text-align:center;color:#333;">
  <p>Please go back and fill in at least your name and email.</p>
</body>
</html>`;

const FALLBACK_THANK_YOU_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Thanks!</title></head>
<body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0b0b12;color:#fff;text-align:center;padding:40px;">
  <div><h1 style="font-size:28px;margin-bottom:12px;">You're in! 🎉</h1><p style="opacity:0.8;">Thanks for signing up — check your inbox for next steps.</p></div>
</body>
</html>`;

// The other end of the opt-in form's action= URL (see FORM_ACTION_PLACEHOLDER in htmlPage.ts and
// how /api/generate/route.ts fills it in). Fully public — real website visitors submit here, not
// authenticated app members — so this is a plain HTML POST target, not a JSON API: it always
// finishes with an HTML response (a redirect or a fallback thank-you page), never a JSON error a
// browser would just display as raw text.
export async function POST(req: NextRequest, { params }: { params: Promise<{ generationId: string }> }) {
  const { generationId } = await params;
  const admin = createAdminClient();

  const { data: generation } = await admin
    .from("generations")
    .select("id, user_id, project_id")
    .eq("id", generationId)
    .maybeSingle();

  if (!generation) {
    return new NextResponse("Not found", { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return new NextResponse("Bad request", { status: 400 });
  }

  const name = String(formData.get("name") || "").trim().slice(0, 200);
  const email = String(formData.get("email") || "").trim().slice(0, 200);
  const phone = String(formData.get("phone") || "").trim().slice(0, 50);

  if (!name && !email) {
    return new NextResponse(MISSING_DETAILS_HTML, { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  const { data: project } = generation.project_id
    ? await admin.from("projects").select("name").eq("id", generation.project_id).maybeSingle()
    : { data: null };
  const projectName = project?.name || "Pitch Perfect AI";

  // Written before the GHL sync is even attempted — a lead is captured here regardless of
  // whether Go High Level is connected yet or the sync call happens to fail.
  const { data: lead } = await admin
    .from("form_leads")
    .insert({
      user_id: generation.user_id,
      project_id: generation.project_id,
      generation_id: generation.id,
      name,
      email,
      phone,
    })
    .select("id")
    .single();

  const { data: connection } = await admin
    .from("ghl_connections")
    .select("location_id, api_token")
    .eq("user_id", generation.user_id)
    .maybeSingle();

  if (connection?.api_token && connection?.location_id) {
    const result = await upsertGhlContact({
      apiToken: connection.api_token,
      locationId: connection.location_id,
      name,
      email,
      phone,
      tags: ["Pitch Perfect Lead", `PP: ${projectName}`],
    });
    if (lead) {
      await admin
        .from("form_leads")
        .update({ ghl_synced: result.ok, ghl_error: result.ok ? null : result.error })
        .eq("id", lead.id);
    }
    if (!result.ok) console.error(`GHL sync failed for generation ${generationId}:`, result.error);
  }

  // Send the visitor to this project's published Thank You Page if one exists — never block on
  // a CRM hiccup, the visitor's experience always completes regardless of whether the GHL sync
  // above succeeded.
  const { data: thankYouPage } = generation.project_id
    ? await admin
        .from("generations")
        .select("publish_slug")
        .eq("project_id", generation.project_id)
        .eq("asset_type", "thank_you_page")
        .not("published_at", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
    : { data: null };

  if (thankYouPage?.publish_slug) {
    return NextResponse.redirect(new URL(`/site/${thankYouPage.publish_slug}`, req.url), { status: 303 });
  }

  return new NextResponse(FALLBACK_THANK_YOU_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
