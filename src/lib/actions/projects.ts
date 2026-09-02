"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { AwarenessLevel } from "@/types/database";
import { ASSET_TYPES } from "@/lib/ai/generators";
import { getTemplate } from "@/lib/templates";
import { getMissingDiscoveryFieldLabels } from "@/lib/projects";
import { canCreateBioProfile } from "@/lib/ai/presenterBio";

// Where to land after creating a project. A brand-new project has no discovery data yet, so
// generating anything from it immediately would just come back empty ("I don't have enough
// information about your business to build this") — always land on the project overview,
// where the Discovery form lives, first. `type` (from the sidebar's "Create" links,
// `/projects/new?type=webinar_outline`, or the Analyzer link, `?type=presentation_analysis`)
// is carried along as `?intent=` so the overview page can highlight which tool the user
// actually wanted and send them straight there the moment discovery is saved.
function projectDestination(projectId: string, type: string | null): string {
  const isValidIntent =
    type === "presentation_analysis" || type === "ad_image" || (type && (ASSET_TYPES as string[]).includes(type));
  return isValidIntent ? `/projects/${projectId}?intent=${type}` : `/projects/${projectId}`;
}

// Every project gets exactly one niche bio, auto-created and named after the project itself — no
// separate "name your niche" step, no picker between existing niches. A member types one name
// once; that's both the project's name and the bio's label, and the two always travel together
// (the bio-fill page that follows shows this same name as its own heading — see
// bio/[profileId]/page.tsx — so there's never a moment of "wait, which project am I in?").
// The tier limit (canCreateBioProfile) is really a project-count limit now, since every project
// consumes exactly one niche slot — checked here, before either row is created.
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
  const type = String(formData.get("type") || "") || null;

  const { data: profile } = await supabase.from("profiles").select("tier, bonus_niche_limit").eq("id", user.id).single();
  const tier = profile?.tier ?? "Gold";
  const bonusNicheLimit = profile?.bonus_niche_limit ?? 0;
  const limitCheck = await canCreateBioProfile(supabase, user.id, tier, bonusNicheLimit);
  if (!limitCheck.ok) return { error: limitCheck.message };

  const { data: newProfile, error: profileError } = await supabase
    .from("presenter_bio_profiles")
    .insert({ user_id: user.id, label: name })
    .select("id")
    .single();
  if (profileError || !newProfile) return { error: "Could not create your project. Try again." };

  const { data, error } = await supabase
    .from("projects")
    .insert({ user_id: user.id, name, presenter_bio_profile_id: newProfile.id })
    .select("id")
    .single();

  if (error || !data) {
    // The bio row was created but the project insert failed — clean it up rather than leaving an
    // orphaned niche silently eating into the member's limit for a project that doesn't exist.
    await supabase.from("presenter_bio_profiles").delete().eq("id", newProfile.id);
    return { error: "Could not create project. Try again." };
  }

  // The sidebar's project switcher (AppSidebar's "Your projects" list) is fetched in the shared
  // (app) layout, not this page — a plain redirect() doesn't refresh it, since layout data is
  // outside the router cache's default revalidation for a same-layout navigation. Every place
  // that adds, removes, or restores a project needs this same call (see deleteProject/
  // restoreProject below) or the sidebar list silently drifts from what's actually in the
  // database until an unrelated full reload happens to clear it.
  revalidatePath("/", "layout");
  const destination = projectDestination(data.id, type);
  // A brand-new project's bio is empty — send them to fill it in first, same returnTo convention
  // used everywhere else this bio work touches (updatePresenterBio, the generate-page redirects).
  redirect(`/bio/${newProfile.id}?returnTo=${encodeURIComponent(destination)}`);
}

// Clones a swipe-file template (src/lib/templates.ts) into a new, pre-filled project — same
// discovery fields the form saves, just populated up front so the user can review/tweak
// instead of starting blank. Lands on the project overview (not straight into the generator)
// so they can check the pre-filled brief before spending credits.
export async function createProjectFromTemplate(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const templateId = String(formData.get("templateId") || "");
  const template = getTemplate(templateId);
  if (!template) redirect("/templates");

  const projectName = `${template.name} (from template)`;

  // Same "one project, one niche, named after the project" rule createProject follows — a
  // template-cloned project is a real project and counts against the same limit. In practice this
  // essentially never blocks: the sample-project flow only exists for brand-new accounts (zero
  // projects yet — see SampleProjectDialog), which are under every tier's limit. Pre-filled with
  // the template's demo bio (audience, credentials, origin story, etc.) rather than left blank, so
  // the "generate in under 60 seconds" promise still holds without a member typing anything first.
  const { data: profile } = await supabase.from("profiles").select("tier, bonus_niche_limit").eq("id", user.id).single();
  const tier = profile?.tier ?? "Gold";
  const bonusNicheLimit = profile?.bonus_niche_limit ?? 0;
  const limitCheck = await canCreateBioProfile(supabase, user.id, tier, bonusNicheLimit);
  if (!limitCheck.ok) redirect("/dashboard");

  const { data: newProfile, error: profileError } = await supabase
    .from("presenter_bio_profiles")
    .insert({ user_id: user.id, label: projectName, ...template.presenterBio })
    .select("id")
    .single();
  if (profileError || !newProfile) redirect("/templates");

  const { data, error } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      name: projectName,
      presenter_bio_profile_id: newProfile.id,
      ...template.answers,
    })
    .select("id")
    .single();

  if (error || !data) {
    await supabase.from("presenter_bio_profiles").delete().eq("id", newProfile.id);
    redirect("/templates");
  }

  revalidatePath("/", "layout");
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
    offer_name: text("offer_name"),
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
    funnel_type: text("funnel_type"),
    discovery_notes: text("discovery_notes"),
    mode: (formData.get("mode") === "coach" ? "coach" : "expert") as "coach" | "expert",
  };

  if (!fields.name) {
    return { error: "Project name can't be empty." };
  }

  // Saving always persists whatever's been filled in, regardless of how much is left blank —
  // an all-or-nothing save (reject the whole update if anything required is still empty) used
  // to sit here, but that meant filling in most of a long brief and saving still lost
  // everything if even one required field was blank, with no way to save partial progress at
  // all. Completeness is enforced separately, only at the point it actually matters: whether a
  // generator can run (projectNeedsDiscovery, checked on the generate page) — not whether
  // progress can be saved.
  const { error } = await supabase
    .from("projects")
    .update(fields)
    .eq("id", projectId)
    .eq("user_id", user.id);

  if (error) {
    return { error: "Could not save changes." };
  }

  // Set by DiscoveryForm when the project was created from a specific agent (?intent=... on
  // the overview page) — finishes the "click agent → land in that tool" trip the user actually
  // asked for. Only actually jumps to the generator once the brief is complete; otherwise it'd
  // just bounce straight back here via the generate page's own completeness gate, so instead
  // stay put and tell them what's still missing.
  const missing = getMissingDiscoveryFieldLabels(fields);
  const redirectTo = String(formData.get("redirectTo") || "");
  if (redirectTo && missing.length === 0) {
    redirect(redirectTo);
  }

  revalidatePath(`/projects/${projectId}`);
  return missing.length > 0 ? { success: true, missing } : { success: true };
}

// Soft-delete: marks the project rather than removing the row, so it (and every generation in
// it) is recoverable from the Dashboard's "Recently deleted" list via restoreProject below,
// instead of one click (or misclick) being permanent and unrecoverable — see
// supabase/migrations/0013_project_soft_delete.sql.
export async function deleteProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const projectId = String(formData.get("projectId") || "");
  await supabase
    .from("projects")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("user_id", user.id);

  // Same reason createProject/createProjectFromTemplate call this — without it, a deleted
  // project kept showing in the sidebar's "Your projects" list (and the tier limit it frees up
  // wouldn't visibly reflect either) until an unrelated full reload happened to clear the layout
  // out of the router cache.
  revalidatePath("/", "layout");
  // Defaults to /dashboard (the original behavior); pages that list+delete projects
  // in place (e.g. /analyze's "previous projects" list) pass their own path to stay put
  // instead of bouncing away after a delete.
  const redirectTo = String(formData.get("redirectTo") || "/dashboard");
  redirect(redirectTo);
}

export async function restoreProject(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const projectId = String(formData.get("projectId") || "");
  await supabase.from("projects").update({ deleted_at: null }).eq("id", projectId).eq("user_id", user.id);

  revalidatePath("/dashboard");
  revalidatePath("/", "layout");
}
