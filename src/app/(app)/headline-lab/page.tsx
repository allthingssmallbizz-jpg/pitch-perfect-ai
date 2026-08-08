import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseRatedHeadlines, type RatedHeadline } from "@/lib/ai/headlineLab";
import HeadlineLabClient from "./HeadlineLabClient";

export default async function HeadlineLabPage({
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

  let initialHeadlines: RatedHeadline[] = [];
  let initialWinners: string[] = [];
  let initialGenerationId: string | null = null;

  if (generationId) {
    const { data: generation } = await supabase
      .from("generations")
      .select("content, winners")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .eq("asset_type", "headline_lab")
      .single();

    if (generation?.content) {
      try {
        initialHeadlines = parseRatedHeadlines(generation.content);
        initialWinners = generation.winners ?? [];
        initialGenerationId = generationId;
      } catch {
        initialHeadlines = [];
      }
    }
  }

  return (
    <HeadlineLabClient
      initialHeadlines={initialHeadlines}
      initialWinners={initialWinners}
      initialGenerationId={initialGenerationId}
    />
  );
}
