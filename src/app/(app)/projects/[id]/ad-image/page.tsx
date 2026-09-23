import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents/config";
import { projectNeedsDiscovery, REQUIRED_DISCOVERY_FIELDS } from "@/lib/projects";
import { isPresenterBioIncomplete } from "@/lib/ai/presenterBio";
import { isRestrictionBypassActive } from "@/lib/adminBypass";
import { AD_IMAGE_CREDIT_COST } from "@/lib/ai/generators/adImage";
import AgentBadge from "@/components/AgentBadge";
import BioBlockedDialog from "@/components/BioBlockedDialog";
import DiscoveryBlockedDialog from "@/components/DiscoveryBlockedDialog";
import AdImageClient, { type PastAdImage } from "./AdImageClient";

export default async function AdImagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ generationId?: string }>;
}) {
  const { id } = await params;
  const { generationId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!project) notFound();

  // An admin who's flipped "Remove Restrictions" in /admin (see isRestrictionBypassActive) still
  // gets the same reminders below, just dismissible instead of a hard block — built for live
  // demos/webinars. Never true for a regular member.
  const bypassActive = await isRestrictionBypassActive(user.id);
  let bioBlockedButBypassed = false;

  // Bio before Discovery before any agent — same gate, same order, as generate/[assetType]/page.tsx,
  // checked against THIS project's linked niche, not just "does the account have a bio anywhere."
  if (!generationId) {
    const returnTo = `/projects/${id}/ad-image`;
    if (!project.presenter_bio_profile_id) {
      redirect(`/bio?returnTo=${encodeURIComponent(returnTo)}`);
    }
    const { data: bio } = await supabase
      .from("presenter_bio_profiles")
      .select("*")
      .eq("id", project.presenter_bio_profile_id)
      .maybeSingle();
    if (isPresenterBioIncomplete(bio)) {
      if (bypassActive) {
        bioBlockedButBypassed = true;
      } else {
        redirect(`/bio/${project.presenter_bio_profile_id}?returnTo=${encodeURIComponent(returnTo)}`);
      }
    }
  }
  // Used to be a silent redirect straight back to the project page — now a blocking popup
  // rendered below, right on this page (see generate/[assetType]/page.tsx for the same change).
  const missingDiscoveryFields =
    !generationId && projectNeedsDiscovery(project)
      ? REQUIRED_DISCOVERY_FIELDS.filter(({ key }) => !String(project[key] ?? "").trim()).map((f) => f.label)
      : [];

  const { data: rows } = await supabase
    .from("generations")
    .select("id, content, image_source_path, image_result_path, created_at")
    .eq("project_id", id)
    .eq("asset_type", "ad_image")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(20);

  const resultPaths = (rows ?? []).map((r) => r.image_result_path).filter((p): p is string => !!p);
  const { data: signedUrls } = resultPaths.length
    ? await supabase.storage.from("ad-images").createSignedUrls(resultPaths, 3600)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const signedUrlByPath = new Map((signedUrls ?? []).map((s) => [s.path, s.signedUrl]));

  const pastGenerations: PastAdImage[] = (rows ?? []).map((r) => {
    let copy = { headline: "", subheadline: "", cta: "" };
    try {
      if (r.content) copy = JSON.parse(r.content);
    } catch {
      // Malformed content shouldn't crash the list — just show blanks for that entry.
    }
    return {
      id: r.id,
      createdAt: r.created_at,
      copy,
      thumbnailUrl: r.image_result_path ? (signedUrlByPath.get(r.image_result_path) ?? null) : null,
    };
  });

  const initial = generationId ? pastGenerations.find((g) => g.id === generationId) ?? null : null;

  const agent = AGENTS.ad_copy;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {bioBlockedButBypassed && project.presenter_bio_profile_id && (
        <BioBlockedDialog profileId={project.presenter_bio_profile_id} projectName={project.name} />
      )}
      {missingDiscoveryFields.length > 0 && (
        <DiscoveryBlockedDialog
          projectId={id}
          projectName={project.name}
          intent="ad_image"
          missingFields={missingDiscoveryFields}
          dismissible={bypassActive}
        />
      )}
      <Link href={`/projects/${id}`} className="text-sm text-primary hover:underline">
        ← {project.name}
      </Link>
      <div className="mt-4 mb-1 flex flex-wrap items-center justify-between gap-3">
        <AgentBadge agent={agent} size="lg" showTagline />
        {/* Same reasoning as the discovery-form generate page's own "Back to Discovery" link —
            a complete brief no longer forces a detour through it before this agent opens, so
            this is the way back in to tweak an answer without starting over from the dashboard. */}
        <Link
          href={`/projects/${id}?intent=ad_image#discovery-form`}
          className="flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-500"
        >
          <ClipboardList className="h-3.5 w-3.5" />
          Back to Discovery
        </Link>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Image Ads · upload a photo, get a finished ad with headline, subheadline, and CTA
        overlaid · {AD_IMAGE_CREDIT_COST} credits per generation
      </p>

      <AdImageClient
        key={generationId ?? "new"}
        projectId={id}
        initial={initial}
        initialPastGenerations={pastGenerations}
      />
    </div>
  );
}
