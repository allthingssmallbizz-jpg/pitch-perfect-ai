import type { Project } from "@/types/database";

// A project is "ready to generate from" once the handful of load-bearing discovery fields are
// filled in — the ones every generator's prompt actually depends on (see DiscoveryForm.tsx's
// required fields). Doesn't require the full brief, just enough that a generator has something
// real to work with instead of Claude coming back with "I don't have enough information."
export function projectNeedsDiscovery(project: Pick<Project, "business_name" | "product" | "audience">): boolean {
  return !project.business_name.trim() || !project.product.trim() || !project.audience.trim();
}
