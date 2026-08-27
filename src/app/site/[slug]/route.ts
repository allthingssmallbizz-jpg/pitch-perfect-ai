import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const NOT_FOUND_HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found</title></head>
<body style="font-family:-apple-system,'Segoe UI',Roboto,sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0b0b12;color:#fff;text-align:center;padding:40px;">
  <div><h1 style="font-size:28px;margin-bottom:8px;">This page isn't available</h1><p style="opacity:0.7;">It may have been unpublished or the link is incorrect.</p></div>
</body>
</html>`;

// The whole "make it live" mechanism: the generated HTML already lives in generations.content —
// this route just serves it back verbatim to anyone who visits, for any generation currently
// published. Deliberately a raw Route Handler (not a page.tsx) so nothing from this app's own
// layout/theme wraps the response — what a visitor sees is exactly, only, the AI-generated
// document. Public route (see "/site" in src/lib/supabase/middleware.ts's PUBLIC_PATHS) — no
// login required, same as any real website.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("generations")
    .select("id, user_id, content")
    .eq("publish_slug", slug)
    .not("published_at", "is", null)
    .maybeSingle();

  if (!data?.content) {
    return new NextResponse(NOT_FOUND_HTML, { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } });
  }

  // Basic analytics (see src/lib/analytics.ts) — one row per load, no visitor dedup. Awaited so a
  // view is never silently dropped, same "record it before anything else can fail" approach as
  // form_leads in the submit route.
  await admin.from("page_views").insert({ user_id: data.user_id, generation_id: data.id });

  return new NextResponse(data.content, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
