import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("projects").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Your projects</h1>
          {profile && (
            <p className="mt-1 text-sm text-neutral-500">
              {profile.credits_balance} / {profile.credits_monthly_allotment} credits this cycle · access
              until {formatDate(profile.access_expires_at)}
            </p>
          )}
        </div>
        <Link
          href="/projects/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + New project
        </Link>
      </div>

      {!projects || projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 p-10 text-center text-neutral-500">
          No projects yet. Create one to start generating assets for your offer.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="rounded-lg border border-neutral-200 bg-white p-5 hover:border-indigo-300 hover:shadow-sm"
            >
              <h3 className="font-semibold">{project.name}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                {project.one_result || project.the_transformation || "No discovery notes yet."}
              </p>
              <p className="mt-3 text-xs text-neutral-400">Updated {formatDate(project.updated_at)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
