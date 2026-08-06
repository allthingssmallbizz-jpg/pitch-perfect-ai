"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const fields = {
    name: String(formData.get("name") || "").trim(),
    one_result: String(formData.get("one_result") || ""),
    who_its_for: String(formData.get("who_its_for") || ""),
    the_problem: String(formData.get("the_problem") || ""),
    the_transformation: String(formData.get("the_transformation") || ""),
    price: String(formData.get("price") || ""),
    bonuses: String(formData.get("bonuses") || ""),
    guarantee: String(formData.get("guarantee") || ""),
    proof: String(formData.get("proof") || ""),
    discovery_notes: String(formData.get("discovery_notes") || ""),
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
