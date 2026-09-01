import { redirect } from "next/navigation";
import { UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { isPresenterBioIncomplete, getMissingBioFieldLabels } from "@/lib/ai/presenterBio";
import StartHereBadge from "@/components/StartHereBadge";
import PresenterBioForm from "./PresenterBioForm";

export default async function PresenterBioPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bio } = await supabase.from("presenter_bios").select("*").eq("user_id", user.id).maybeSingle();
  const missingFields = getMissingBioFieldLabels(bio);

  // Set by every hard "finish your bio first" redirect (generate/[assetType]/page.tsx,
  // ad-image/page.tsx) so Save can send them straight back instead of stranding them here — see
  // updatePresenterBio. Only ever a same-app path we generated ourselves, but sanitized anyway
  // since it arrives as a raw query param: must start with a single "/", never "//" (which some
  // clients resolve as a protocol-relative URL to another host).
  const { returnTo: rawReturnTo } = await searchParams;
  const returnTo = rawReturnTo && rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <UserCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-3xl font-bold text-gradient-silver">My Webinar Bio</h1>
            {isPresenterBioIncomplete(bio) && <StartHereBadge />}
          </div>
          <p className="mt-1 text-muted-foreground">
            Who you are behind the offer — your mission, credentials, origin story, a real
            setback, your greatest client win. Fill this in once here, and it&apos;s automatically
            available to every project&apos;s Webinar, VSL, and every other agent — you&apos;ll
            never have to retype it.
          </p>
          {missingFields.length > 0 && (
            <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <p className="font-medium text-primary">
                {returnTo
                  ? "Finish this first — every agent needs it to write a strong, credible presentation. Save below and you'll go straight back to what you were doing."
                  : "Every field marked * below is required before any agent will generate for you."}
              </p>
              <p className="mt-1 text-muted-foreground">Still missing: {missingFields.join(", ")}.</p>
            </div>
          )}
        </div>
      </div>

      <PresenterBioForm bio={bio} redirectTo={returnTo} />
    </div>
  );
}
