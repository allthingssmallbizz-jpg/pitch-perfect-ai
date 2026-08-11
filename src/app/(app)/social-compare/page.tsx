import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AGENTS } from "@/lib/agents/config";
import { SOCIAL_COMPARE_CREDIT_COST } from "@/lib/ai/socialCompare";
import AgentBadge from "@/components/AgentBadge";
import SocialCompareClient from "./SocialCompareClient";

// Standalone, not project-scoped — same reasoning as Headline Lab (see headline-lab/page.tsx):
// this tool doesn't read a project's discovery fields at all, it only needs the two page
// addresses, so there's no reason to make anyone create/name a project or fill in discovery
// first just to run a comparison.
export default async function SocialComparePage({
  searchParams,
}: {
  searchParams: Promise<{ generationId?: string }>;
}) {
  const { generationId } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let initialContent: string | null = null;
  let initialGenerationId: string | null = null;

  if (generationId) {
    const { data: generation } = await supabase
      .from("generations")
      .select("id, content")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .eq("asset_type", "social_compare")
      .single();
    if (generation) {
      initialContent = generation.content;
      initialGenerationId = generation.id;
    }
  }

  const { data: pastGenerationRows } = await supabase
    .from("generations")
    .select("id, content, created_at")
    .eq("user_id", user.id)
    .eq("asset_type", "social_compare")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(30);

  const pastGenerations = (pastGenerationRows ?? []).map((g) => ({
    id: g.id,
    createdAt: g.created_at,
    preview: (g.content ?? "").replace(/\s+/g, " ").trim().slice(0, 120),
  }));

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-1">
        <AgentBadge agent={AGENTS.presentation_analysis} size="lg" showTagline />
      </div>
      <p className="mb-6 text-sm text-muted-foreground">
        Social Media Comparison · compare your TikTok/Instagram/Facebook page against a
        high-performing one · {SOCIAL_COMPARE_CREDIT_COST} credits per comparison
      </p>

      <SocialCompareClient
        initialContent={initialContent}
        initialGenerationId={initialGenerationId}
        initialPastGenerations={pastGenerations}
      />
    </div>
  );
}
