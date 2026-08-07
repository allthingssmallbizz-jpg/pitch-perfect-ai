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

  if (generationId) {
    const { data: generation } = await supabase
      .from("generations")
      .select("content")
      .eq("id", generationId)
      .eq("user_id", user.id)
      .eq("asset_type", "headline_lab")
      .single();

    if (generation?.content) {
      try {
        initialHeadlines = parseRatedHeadlines(generation.content);
      } catch {
        initialHeadlines = [];
      }
    }
  }

  return <HeadlineLabClient initialHeadlines={initialHeadlines} />;
}
