"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AwarenessLevel, StackItem, FastActionBonus } from "@/types/database";
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

// Reported need: a member running the same offer two ways (a small private cohort vs. the full
// public webinar launch) wants to start the second one from everything already built for the
// first, then tweak it independently — not regenerate everything from scratch, and not risk
// editing the original while adapting it. Clones the project's own discovery fields, its niche
// bio (its own new row — every project requires exactly one bio, same rule createProject follows,
// so sharing one row between two projects isn't an option here), and the CURRENT content for
// every asset type/module already generated (the latest complete generation per asset_type +
// module_identifier pair — not its full edit history or past superseded drafts, which would
// balloon this into copying everything ever generated for comparatively little benefit). A
// duplicate starts fresh on publishing (publish_slug/published_at reset to null) so it's never
// silently "live" at the original's link, and slide_media (Build Module Slides' per-slide images/
// charts) is copied alongside its matching generation so a duplicated deck doesn't quietly lose
// its visuals. No credits charged — this is a database copy, not a new AI generation.
export async function duplicateProject(_prevState: unknown, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const projectId = String(formData.get("projectId") || "");
  const { data: original } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!original) return { error: "Could not find that project." };

  // Same gate createProject applies — a duplicate is a real project and consumes the same one
  // niche slot every project does, no exception for being a copy.
  const { data: profile } = await supabase.from("profiles").select("tier, bonus_niche_limit").eq("id", user.id).single();
  const tier = profile?.tier ?? "Gold";
  const bonusNicheLimit = profile?.bonus_niche_limit ?? 0;
  const limitCheck = await canCreateBioProfile(supabase, user.id, tier, bonusNicheLimit);
  if (!limitCheck.ok) return { error: limitCheck.message };

  const newName = `${original.name} (Copy)`;

  const { data: originalBio } = original.presenter_bio_profile_id
    ? await supabase.from("presenter_bio_profiles").select("*").eq("id", original.presenter_bio_profile_id).maybeSingle()
    : { data: null };

  // Explicit field lists (same style as updateProjectDiscovery's own `fields` below) rather than
  // spreading-minus-a-few-keys — keeps exactly what gets copied visible at a glance, and a column
  // this list doesn't yet know about (id/timestamps/ownership) can never leak through by accident.
  const bioFields = originalBio
    ? {
        presenter_ihelp_audience: originalBio.presenter_ihelp_audience,
        presenter_ihelp_outcome: originalBio.presenter_ihelp_outcome,
        presenter_ihelp_mechanism: originalBio.presenter_ihelp_mechanism,
        presenter_ihelp_pain_point: originalBio.presenter_ihelp_pain_point,
        presenter_ihelp_statement: originalBio.presenter_ihelp_statement,
        presenter_mission: originalBio.presenter_mission,
        presenter_years_experience: originalBio.presenter_years_experience,
        presenter_credentials: originalBio.presenter_credentials,
        presenter_origin_story: originalBio.presenter_origin_story,
        presenter_signature_win: originalBio.presenter_signature_win,
        presenter_setback_story: originalBio.presenter_setback_story,
        presenter_epiphany_moment: originalBio.presenter_epiphany_moment,
        presenter_mentor: originalBio.presenter_mentor,
        presenter_conflict_story: originalBio.presenter_conflict_story,
        presenter_income_goal_6mo: originalBio.presenter_income_goal_6mo,
        presenter_income_goal_12mo: originalBio.presenter_income_goal_12mo,
        presenter_mission_why: originalBio.presenter_mission_why,
        presenter_recognition: originalBio.presenter_recognition,
        presenter_relatable_detail: originalBio.presenter_relatable_detail,
        presenter_voice_tone: originalBio.presenter_voice_tone,
        presenter_voice_preferred_words: originalBio.presenter_voice_preferred_words,
        presenter_voice_forbidden_words: originalBio.presenter_voice_forbidden_words,
        presenter_voice_sample_writing: originalBio.presenter_voice_sample_writing,
        presenter_voice_notes: originalBio.presenter_voice_notes,
      }
    : {};
  const { data: newBio, error: bioError } = await supabase
    .from("presenter_bio_profiles")
    .insert({ ...bioFields, user_id: user.id, label: newName })
    .select("id")
    .single();
  if (bioError || !newBio) return { error: "Could not duplicate this project. Try again." };

  const discoveryFields = {
    business_name: original.business_name,
    industry: original.industry,
    product: original.product,
    offer_name: original.offer_name,
    audience: original.audience,
    existing_assets: original.existing_assets,
    awareness_level: original.awareness_level,
    pain_points: original.pain_points,
    false_beliefs: original.false_beliefs,
    desired_transformation: original.desired_transformation,
    category: original.category,
    enemy: original.enemy,
    differentiator: original.differentiator,
    competitive_alternatives: original.competitive_alternatives,
    unique_mechanism: original.unique_mechanism,
    core_promise: original.core_promise,
    outcomes: original.outcomes,
    proof: original.proof,
    price: original.price,
    guarantee: original.guarantee,
    bonuses: original.bonuses,
    core_offer_value: original.core_offer_value,
    stack_items: original.stack_items,
    fast_action_bonuses: original.fast_action_bonuses,
    scarcity_urgency: original.scarcity_urgency,
    cta: original.cta,
    funnel_type: original.funnel_type,
    discovery_notes: original.discovery_notes,
    course_naming: original.course_naming,
    mode: original.mode,
  };
  const { data: newProject, error: projectError } = await supabase
    .from("projects")
    .insert({ ...discoveryFields, user_id: user.id, name: newName, presenter_bio_profile_id: newBio.id })
    .select("id")
    .single();
  if (projectError || !newProject) {
    await supabase.from("presenter_bio_profiles").delete().eq("id", newBio.id);
    return { error: "Could not duplicate this project. Try again." };
  }

  // Everything below writes generations/slide_media directly (not through a user-scoped RLS
  // policy, which only ever allows a member to read their own rows — every real write to these
  // tables elsewhere in the app goes through the admin client the same way, see
  // /api/generate/route.ts and the edit route).
  const admin = createAdminClient();

  const { data: allGenerations } = await admin
    .from("generations")
    .select("*")
    .eq("project_id", projectId)
    .eq("status", "complete")
    .order("created_at", { ascending: false });

  // The CURRENT content for each asset type/module — first-seen-wins after sorting newest first,
  // same dedup pattern used for cross-generator "stay consistent with" context in
  // /api/generate/route.ts and the dashboard's own latestGenerationByProject.
  const seen = new Set<string>();
  const currentGenerations = (allGenerations ?? []).filter((g) => {
    const key = `${g.asset_type}::${g.module_identifier ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const idMap = new Map<string, string>();
  for (const gen of currentGenerations) {
    const { data: inserted } = await admin
      .from("generations")
      .insert({
        user_id: user.id,
        project_id: newProject.id,
        asset_type: gen.asset_type,
        mode: gen.mode,
        status: gen.status,
        content: gen.content,
        input_content: gen.input_content,
        model: gen.model,
        input_tokens: gen.input_tokens,
        output_tokens: gen.output_tokens,
        cost_usd: gen.cost_usd,
        credits_charged: gen.credits_charged,
        video_path: gen.video_path,
        video_duration_seconds: gen.video_duration_seconds,
        video_size_bytes: gen.video_size_bytes,
        transcript: gen.transcript,
        transcription_cost_usd: gen.transcription_cost_usd,
        winners: gen.winners,
        image_source_path: gen.image_source_path,
        image_result_path: gen.image_result_path,
        // Deliberately reset, not copied — a duplicate should never already be "live" at the
        // original's publish link, and approval state is a separate per-content judgment that's
        // fine to carry over as-is (see module_identifier/approved_at just below).
        publish_slug: null,
        published_at: null,
        approved_at: gen.approved_at,
        module_identifier: gen.module_identifier,
        // Fixed up in the pass below once every id in this batch has its new counterpart —
        // never copied directly, since it points at another generation's id, and that id is
        // about to change for every row in this same duplication.
        source_generation_id: null,
      })
      .select("id")
      .single();
    if (inserted) idMap.set(gen.id, inserted.id);
  }

  for (const gen of currentGenerations) {
    if (!gen.source_generation_id) continue;
    const newSourceId = idMap.get(gen.source_generation_id);
    const newOwnId = idMap.get(gen.id);
    if (newSourceId && newOwnId) {
      await admin.from("generations").update({ source_generation_id: newSourceId }).eq("id", newOwnId);
    }
  }

  for (const [oldId, newId] of idMap.entries()) {
    const { data: media } = await admin.from("slide_media").select("*").eq("generation_id", oldId);
    if (media?.length) {
      await admin.from("slide_media").insert(
        media.map((m) => ({
          generation_id: newId,
          user_id: user.id,
          slide_number: m.slide_number,
          kind: m.kind,
          storage_path: m.storage_path,
          chart_type: m.chart_type,
          chart_data: m.chart_data,
          prompt: m.prompt,
        }))
      );
    }
  }

  revalidatePath("/", "layout");
  redirect(`/projects/${newProject.id}`);
}

// DiscoveryForm's Value Stack list serializes to this single hidden field as JSON (see
// 0045_value_stack.sql, 0046_bonus_category_and_fab.sql) — parsed defensively since it's
// client-built, dropping any row that isn't a real {name, value} pair of strings rather than
// letting a malformed value corrupt the column or crash the save. `category` is optional and
// passed through as-is only when it's actually "stack" or "bonus" — anything else (a drifted
// client, a hand-edited draft) is dropped rather than saved, so a bad value can't silently steer
// the reveal wrong later; formatValueStackBlock defaults a missing category to "stack" when read.
function parseStackItems(raw: string): StackItem[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is StackItem => typeof item?.name === "string" && typeof item?.value === "string")
      .map((item) => ({
        name: item.name,
        value: item.value,
        ...(item.category === "stack" || item.category === "bonus" ? { category: item.category } : {}),
      }));
  } catch {
    return [];
  }
}

// Same defensive parse for the separate Fast Action Bonus list (see 0046_bonus_category_and_fab.sql).
function parseFastActionBonuses(raw: string): FastActionBonus[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is FastActionBonus =>
          typeof item?.name === "string" && typeof item?.value === "string" && typeof item?.condition === "string"
      )
      .map((item) => ({ name: item.name, value: item.value, condition: item.condition }));
  } catch {
    return [];
  }
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
    core_offer_value: text("core_offer_value"),
    stack_items: parseStackItems(text("stack_items")),
    fast_action_bonuses: parseFastActionBonuses(text("fast_action_bonuses")),
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
