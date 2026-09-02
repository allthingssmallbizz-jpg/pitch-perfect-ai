import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPresenterBioIncomplete, getMissingBioFieldLabels } from "@/lib/ai/presenterBio";
import StartHereBadge from "@/components/StartHereBadge";
import PresenterBioForm from "../PresenterBioForm";

export default async function PresenterBioProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { profileId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: bio }, { data: project }] = await Promise.all([
    supabase.from("presenter_bio_profiles").select("*").eq("id", profileId).eq("user_id", user.id).maybeSingle(),
    // One project per bio (see createProject in src/lib/actions/projects.ts) — used so the back
    // link and the page's own framing keep saying the actual project name, not a generic "My
    // Bio," so a member never loses track of which project they're in partway through.
    supabase
      .from("projects")
      .select("id")
      .eq("presenter_bio_profile_id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (!bio) notFound();

  const missingFields = getMissingBioFieldLabels(bio);

  // Set by every hard "finish this bio first" redirect (generate/[assetType]/page.tsx,
  // ad-image/page.tsx) so Save can send them straight back instead of stranding them here — see
  // updatePresenterBio. Only ever a same-app path we generated ourselves, but sanitized anyway
  // since it arrives as a raw query param: must start with a single "/", never "//" (which some
  // clients resolve as a protocol-relative URL to another host).
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* The marquee — the very first thing on the page, above even the back link, so a member
          who's just been dropped in here (from project creation, a blocked agent, or a "finish
          this first" redirect) sees which project's bio this is before anything else. */}
      <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          You&apos;re working in
        </p>
        <p className="font-display text-lg font-bold text-gradient-silver">{bio.label}</p>
      </div>
      <Link href={project ? `/projects/${project.id}` : "/bio"} className="text-sm text-primary hover:underline">
        ← {project ? bio.label : "My Bio"}
      </Link>
      <div className="mt-4 mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <UserCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-bold text-gradient-silver">{bio.label}</h1>
            {isPresenterBioIncomplete(bio) && <StartHereBadge />}
          </div>
          <p className="mt-1 text-muted-foreground">
            Who you are behind this project&apos;s offer — your mission, credentials, origin
            story, a real setback, your greatest client win. Fill this in once here, and
            it&apos;s automatically available to every agent working on {bio.label} — you&apos;ll
            never have to retype it.
          </p>
          {missingFields.length > 0 && (
            <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <p className="font-medium text-primary">
                {returnTo
                  ? "Finish this first — every agent needs it to write a strong, credible presentation. Save below and you'll go straight back to what you were doing."
                  : `Every field marked * below is required before any agent will generate for ${bio.label}.`}
              </p>
              <p className="mt-1 text-muted-foreground">Still missing: {missingFields.join(", ")}.</p>
            </div>
          )}
        </div>
      </div>

      <PresenterBioForm bio={bio} profileId={bio.id} redirectTo={returnTo} />
    </div>
  );
}
