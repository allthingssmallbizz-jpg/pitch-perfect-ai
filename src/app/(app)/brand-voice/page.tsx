import { redirect } from "next/navigation";
import { Mic } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import BrandVoiceForm from "./BrandVoiceForm";

export default async function BrandVoicePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brandVoice } = await supabase.from("brand_voices").select("*").eq("user_id", user.id).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <Mic className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold text-gradient-silver">Brand voice profile</h1>
          <p className="mt-1 text-muted-foreground">
            Teach Pitch Perfect AI to sound like you. Every deliverable — webinar, VSL, emails, ads — will
            match this voice automatically.
          </p>
        </div>
      </div>

      <BrandVoiceForm brandVoice={brandVoice} />
    </div>
  );
}
