import { redirect } from "next/navigation";
import { UserCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import PresenterBioForm from "./PresenterBioForm";

export default async function PresenterBioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: bio } = await supabase.from("presenter_bios").select("*").eq("user_id", user.id).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <UserCircle className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-gradient-silver">My Webinar Bio</h1>
          <p className="mt-1 text-muted-foreground">
            Who you are behind the offer — your mission, credentials, origin story, a real
            setback, your greatest client win. Fill this in once here, and it&apos;s automatically
            available to every project&apos;s Webinar, VSL, and every other agent — you&apos;ll
            never have to retype it.
          </p>
        </div>
      </div>

      <PresenterBioForm bio={bio} />
    </div>
  );
}
