"use client";

import { useActionState } from "react";
import type { Project } from "@/types/database";
import { updateProjectDiscovery, deleteProject } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const AWARENESS_LEVELS = ["Unaware", "Problem-Aware", "Solution-Aware", "Product-Aware", "Most Aware"];

function Field({
  label,
  name,
  defaultValue,
  textarea = true,
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-primary"> *</span>}
      </Label>
      {textarea ? (
        <Textarea id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} rows={2} className="mt-1" />
      ) : (
        <Input id={name} name={name} defaultValue={defaultValue} placeholder={placeholder} className="mt-1" />
      )}
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <div>
        <h3 className="font-display text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

export default function DiscoveryForm({ project }: { project: Project }) {
  const [state, formAction, pending] = useActionState(updateProjectDiscovery, undefined);

  return (
    <form action={formAction} className="card-elevated space-y-6 rounded-2xl p-6">
      <input type="hidden" name="projectId" value={project.id} />

      <Field label="Project name" name="name" defaultValue={project.name} textarea={false} required />

      <Section title="Discovery" subtitle="The foundation — who you are and who you serve.">
        <Field label="Business or brand name" name="business_name" defaultValue={project.business_name} textarea={false} required />
        <Field
          label="Industry / niche"
          name="industry"
          defaultValue={project.industry}
          textarea={false}
          placeholder="e.g. Fitness coaching for busy professionals"
          required
        />
        <Field
          label="Product or service"
          name="product"
          defaultValue={project.product}
          placeholder="What are you selling? Describe it in a few sentences."
          required
        />
        <Field
          label="Target audience"
          name="audience"
          defaultValue={project.audience}
          placeholder="Who is this for? Demographics, job, life stage, income, values."
          required
        />
        <Field
          label="Existing marketing assets"
          name="existing_assets"
          defaultValue={project.existing_assets}
          placeholder="Website, email list, ads, testimonials, case studies — anything you already have."
        />
      </Section>

      <Section title="Customer Awareness" subtitle="Where your prospect is on the awareness ladder.">
        <div>
          <Label htmlFor="awareness_level">
            Awareness level<span className="text-primary"> *</span>
          </Label>
          <select
            id="awareness_level"
            name="awareness_level"
            defaultValue={project.awareness_level}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-input/30 px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="">Select...</option>
            {AWARENESS_LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
        </div>
        <Field
          label="Biggest pain points"
          name="pain_points"
          defaultValue={project.pain_points}
          placeholder="What keeps them up at night? Be specific."
          required
        />
        <Field
          label="False beliefs / objections"
          name="false_beliefs"
          defaultValue={project.false_beliefs}
          placeholder="What do they wrongly believe about the problem or solution?"
        />
        <Field
          label="Desired transformation"
          name="desired_transformation"
          defaultValue={project.desired_transformation}
          placeholder="What does life look like after your solution works?"
          required
        />
      </Section>

      <Section title="Positioning" subtitle="Category, enemy, and what makes you different.">
        <Field
          label="Market category"
          name="category"
          defaultValue={project.category}
          textarea={false}
          placeholder="e.g. 'Online sales training' or 'Metabolic coaching'"
          required
        />
        <Field
          label="The enemy / villain"
          name="enemy"
          defaultValue={project.enemy}
          placeholder="What common industry idea, method, or 'guru' are you against?"
        />
        <Field
          label="Primary differentiator"
          name="differentiator"
          defaultValue={project.differentiator}
          placeholder="What makes your approach different from everyone else's?"
          required
        />
        <Field
          label="Competitive alternatives"
          name="competitive_alternatives"
          defaultValue={project.competitive_alternatives}
          placeholder="What are they doing today instead of buying from you?"
        />
      </Section>

      <Section title="Value Proposition" subtitle="Unique mechanism, outcomes, and proof.">
        <Field
          label="Unique mechanism"
          name="unique_mechanism"
          defaultValue={project.unique_mechanism}
          placeholder="The 'how' behind your promise — a named framework, method, or system."
          required
        />
        <Field
          label="Core promise"
          name="core_promise"
          defaultValue={project.core_promise}
          placeholder="What one outcome do you guarantee?"
          required
        />
        <Field
          label="Top outcomes / benefits"
          name="outcomes"
          defaultValue={project.outcomes}
          placeholder="Bullet list of results the buyer gets."
          required
        />
        <Field
          label="Proof available"
          name="proof"
          defaultValue={project.proof}
          placeholder="Testimonials, case studies, credentials, data, media — used verbatim, never invented."
        />
      </Section>

      <Section title="Offer" subtitle="Price, bonuses, guarantee, urgency.">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Price point"
            name="price"
            defaultValue={project.price}
            textarea={false}
            placeholder="e.g. $1,997 one-time or $297/month"
            required
          />
          <div>
            <Label htmlFor="mode">Mode</Label>
            <select
              id="mode"
              name="mode"
              defaultValue={project.mode}
              className="mt-1 flex h-9 w-full rounded-md border border-input bg-input/30 px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <option value="expert">Expert Mode (fast, polished)</option>
              <option value="coach">Coach Mode (asks questions first)</option>
            </select>
          </div>
        </div>
        <Field label="Guarantee" name="guarantee" defaultValue={project.guarantee} placeholder="Money-back? Results-based? Describe it." />
        <Field
          label="Bonuses (if any)"
          name="bonuses"
          defaultValue={project.bonuses}
          placeholder="List each bonus and its perceived value."
        />
        <Field
          label="Scarcity / urgency"
          name="scarcity_urgency"
          defaultValue={project.scarcity_urgency}
          placeholder="Deadlines, seat limits, price increases, cohort dates."
        />
        <Field
          label="Primary call to action"
          name="cta"
          defaultValue={project.cta}
          textarea={false}
          placeholder="e.g. Book a call, Buy now, Apply today"
          required
        />
      </Section>

      <Field
        label="Additional discovery notes"
        name="discovery_notes"
        defaultValue={project.discovery_notes}
        placeholder="Verbatim customer language, objections, anything else from the Discovery interviews"
      />

      <div className="flex items-center justify-between border-t border-border pt-5">
        <Button type="submit" disabled={pending} size="sm">
          {pending ? "Saving..." : "Save discovery"}
        </Button>
        {state && "success" in state && state.success && <span className="text-sm text-emerald-400">Saved.</span>}
        {state && "error" in state && state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>

      <details className="pt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Delete project</summary>
        <form action={deleteProject} className="mt-2">
          <input type="hidden" name="projectId" value={project.id} />
          <button type="submit" className="text-xs text-destructive hover:underline">
            Permanently delete this project and its generations
          </button>
        </form>
      </details>
    </form>
  );
}
