"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AwarenessLevel } from "@/types/database";

export async function createProject(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  if (!name) {
    return { error: "Give your project a name." };
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Could not create project. Try again." };
  }

  redirect(`/projects/${data.id}`);
}

export async function updateProjectDiscovery(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const projectId = String(formData.get("projectId") || "");

  const text = (key: string) => String(formData.get(key) || "");

  const fields = {
    name: text("name").trim(),
    // Discovery
    business_name: text("business_name"),
    industry: text("industry"),
    product: text("product"),
    audience: text("audience"),
    existing_assets: text("existing_assets"),
    // Customer Awareness
    awareness_level: text("awareness_level") as AwarenessLevel,
    pain_points: text("pain_points"),
    false_beliefs: text("false_beliefs"),
    desired_transformation: text("desired_transformation"),
    // Positioning
    category: text("category"),
    enemy: text("enemy"),
    differentiator: text("differentiator"),
    competitive_alternatives: text("competitive_alternatives"),
    // Value Proposition
    unique_mechanism: text("unique_mechanism"),
    core_promise: text("core_promise"),
    outcomes: text("outcomes"),
    proof: text("proof"),
    // Offer
    price: text("price"),
    guarantee: text("guarantee"),
    bonuses: text("bonuses"),
    scarcity_urgency: text("scarcity_urgency"),
    cta: text("cta"),
    discovery_notes: text("discovery_notes"),
    mode: (formData.get("mode") === "coach" ? "coach" : "expert") as "coach" | "expert",
  };

  if (!fields.name) {
    return { error: "Project name can't be empty." };
  }

  const { error } = await supabase
    .from("projects")
    .update(fields)
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not save changes." };
  }

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function deleteProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const projectId = String(formData.get("projectId") || "");
  await supabase.from("projects").delete().eq("id", projectId).eq("user_id", user.id);

  redirect("/dashboard");
}
