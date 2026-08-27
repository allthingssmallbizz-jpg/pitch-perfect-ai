"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Sparkles, Globe, Wand2, UserCircle, ArrowRight } from "lucide-react";
import type { Project } from "@/types/database";
import { updateProjectDiscovery } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import DiscoveryAssistDialog, { type AssistTarget } from "@/components/DiscoveryAssistDialog";
import WebsiteImportDialog from "@/components/WebsiteImportDialog";
import OfferBuilderDialog from "@/components/OfferBuilderDialog";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import { FUNNEL_TYPES } from "@/lib/funnelType";

const AWARENESS_LEVELS = ["Unaware", "Problem-Aware", "Solution-Aware", "Product-Aware", "Most Aware"];

// Every field name that can be a discovery-assist target — used to collect "other answers"
// context (from the DOM, since this form is uncontrolled/defaultValue-based) when the assist
// dialog opens, and to write an accepted AI draft back into the right input.
const DISCOVERY_FIELD_NAMES = [
  "business_name",
  "industry",
  "product",
  "offer_name",
  "audience",
  "existing_assets",
  "awareness_level",
  "pain_points",
  "false_beliefs",
  "desired_transformation",
  "category",
  "enemy",
  "differentiator",
  "competitive_alternatives",
  "unique_mechanism",
  "core_promise",
  "outcomes",
  "proof",
  "price",
  "guarantee",
  "bonuses",
  "scarcity_urgency",
  "cta",
  "funnel_type",
  "discovery_notes",
];

function AssistButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
    >
      <Sparkles className="h-3 w-3" />
      AI Assist
    </button>
  );
}

function Field({
  label,
  name,
  defaultValue,
  textarea = true,
  placeholder,
  required = false,
  blockSubmitIfEmpty = false,
  hint,
  onAssist,
}: {
  label: string;
  name: string;
  defaultValue: string;
  textarea?: boolean;
  placeholder?: string;
  // Purely the visual asterisk — "generating needs this eventually," not "you can't save
  // without it." Saving must always work with whatever's filled in so far; only the project
  // name (the one field a project can't meaningfully exist without) also sets
  // blockSubmitIfEmpty to stop the browser submitting the form at all while it's blank.
  required?: boolean;
  blockSubmitIfEmpty?: boolean;
  // Plain-language "why this matters / how to answer it" line shown under the label — the
  // membership skews 45-55+ and often has never filled out a marketing discovery brief before,
  // so a placeholder example alone (which disappears the moment they start typing) isn't
  // enough context on its own.
  hint?: string;
  onAssist?: (target: AssistTarget) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={name}>
          {label}
          {required && <span className="text-primary"> *</span>}
        </Label>
        {onAssist && (
          <AssistButton
            onClick={() => onAssist({ key: name, label, type: textarea ? "textarea" : "text", placeholder })}
          />
        )}
      </div>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      {textarea ? (
        <Textarea
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          rows={2}
          required={blockSubmitIfEmpty}
          className="mt-1"
        />
      ) : (
        <Input
          id={name}
          name={name}
          defaultValue={defaultValue}
          placeholder={placeholder}
          required={blockSubmitIfEmpty}
          className="mt-1"
        />
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

export default function DiscoveryForm({
  project,
  redirectTo = null,
}: {
  project: Project;
  redirectTo?: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProjectDiscovery, undefined);
  const [assistTarget, setAssistTarget] = useState<AssistTarget | null>(null);
  const [websiteImportOpen, setWebsiteImportOpen] = useState(false);
  const [offerBuilderOpen, setOfferBuilderOpen] = useState(false);

  function collectOtherAnswers(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const key of DISCOVERY_FIELD_NAMES) {
      const el = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
      if (el) out[key] = el.value;
    }
    return out;
  }

  function handleAssistAccept(key: string, text: string) {
    const el = document.getElementById(key) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (el) el.value = text;
  }

  function handleWebsiteImportAccept(values: Record<string, string>) {
    for (const [key, text] of Object.entries(values)) handleAssistAccept(key, text);
  }

  return (
    <form id="discovery-form" action={formAction} className="card-elevated space-y-6 rounded-2xl p-6">
      <input type="hidden" name="projectId" value={project.id} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}

      <button
        type="button"
        onClick={() => setWebsiteImportOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:border-primary/50"
      >
        <Globe className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Import from your website</span>
          <span className="block text-xs text-muted-foreground">
            Already have a website? Paste the address and the AI drafts what it can from it —
            review before anything&apos;s inserted.
          </span>
        </span>
      </button>

      <button
        type="button"
        onClick={() => setOfferBuilderOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:border-primary/50"
      >
        <Wand2 className="h-5 w-5 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-foreground">Offer Builder</span>
          <span className="block text-xs text-muted-foreground">
            Don&apos;t know what to name your webinar, what to charge, or how to close yet? Get a
            full starter offer drafted — name, price, demo stack, and the best closing mechanism
            for your niche — to review and tweak.
          </span>
        </span>
      </button>

      <Link
        href="/bio"
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3 text-left transition-colors hover:border-primary/50"
      >
        <span className="flex items-center gap-3">
          <UserCircle className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">My Webinar Bio</span>
            <span className="block text-xs text-muted-foreground">
              One-time setup, shared across every project — your mission, credentials, origin
              story, and a real setback, used automatically by Webinar, VSL, and every other agent.
            </span>
          </span>
        </span>
        <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
      </Link>

      <Field label="Project name" name="name" defaultValue={project.name} textarea={false} required blockSubmitIfEmpty />

      <Section title="Discovery" subtitle="The foundation — who you are and who you serve.">
        <Field
          label="Business or brand name"
          name="business_name"
          defaultValue={project.business_name}
          textarea={false}
          placeholder="e.g. Coach Bowe's Pitch Perfect Method"
          hint="Just how you want to be introduced — the name people will hear on the webinar."
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="Industry / niche"
          name="industry"
          defaultValue={project.industry}
          textarea={false}
          placeholder="e.g. Fitness coaching for busy professionals"
          hint="What field are you in, and who specifically do you help? Being specific here — not just 'health' but 'weight loss coaching for women over 50' — helps every generator write like it knows your exact audience, not a generic one."
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="Product or service"
          name="product"
          defaultValue={project.product}
          placeholder="What are you selling? Describe it in a few sentences."
          hint="Explain it in plain, everyday words — imagine describing it to a friend, not writing a brochure."
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="Webinar / offer name"
          name="offer_name"
          defaultValue={project.offer_name}
          textarea={false}
          placeholder="What your audience will actually see — a title, not a description."
          hint="Don't have one yet? Use the Offer Builder button above — it'll suggest a few."
          onAssist={setAssistTarget}
        />
        <Field
          label="Target audience"
          name="audience"
          defaultValue={project.audience}
          placeholder="Who is this for? Demographics, job, life stage, income, values."
          hint="The more specific — age range, what they're struggling with, what they've already tried — the better every headline lands, because it'll sound like you're speaking to one person, not 'everyone.'"
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="Existing marketing assets"
          name="existing_assets"
          defaultValue={project.existing_assets}
          placeholder="Website, email list, ads, testimonials, case studies — anything you already have."
          onAssist={setAssistTarget}
        />
      </Section>

      <Section title="Customer Awareness" subtitle="Where your prospect is on the awareness ladder.">
        <div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="awareness_level">
              Awareness level<span className="text-primary"> *</span>
            </Label>
            <AssistButton
              onClick={() =>
                setAssistTarget({
                  key: "awareness_level",
                  label: "Awareness level",
                  type: "select",
                  options: AWARENESS_LEVELS,
                })
              }
            />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            How much does your audience already know? Not sure — &quot;Problem-Aware&quot; is a
            safe default: most people know they have the problem, just not your solution yet.
          </p>
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
          hint="What's frustrating them right now, in their own words? Think about what a real client has actually said to you — not textbook language."
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="False beliefs / objections"
          name="false_beliefs"
          defaultValue={project.false_beliefs}
          placeholder="What do they wrongly believe about the problem or solution?"
          onAssist={setAssistTarget}
        />
        <Field
          label="Desired transformation"
          name="desired_transformation"
          defaultValue={project.desired_transformation}
          placeholder="What does life look like after your solution works?"
          hint="Paint the 'after' picture — what changes for them once this problem is actually solved?"
          required
          onAssist={setAssistTarget}
        />
      </Section>

      <Section title="Positioning" subtitle="Category, enemy, and what makes you different.">
        <Field
          label="Market category"
          name="category"
          defaultValue={project.category}
          textarea={false}
          placeholder="e.g. 'Online sales training' or 'Metabolic coaching'"
          hint="What would you call this if you had to put it on a shelf next to your competitors?"
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="The enemy / villain"
          name="enemy"
          defaultValue={project.enemy}
          placeholder="What common industry idea, method, or 'guru' are you against?"
          onAssist={setAssistTarget}
        />
        <Field
          label="Primary differentiator"
          name="differentiator"
          defaultValue={project.differentiator}
          placeholder="What makes your approach different from everyone else's?"
          hint="What makes you different from everyone else teaching or selling something similar? This is the reason someone chooses you over a competitor."
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="Competitive alternatives"
          name="competitive_alternatives"
          defaultValue={project.competitive_alternatives}
          placeholder="What are they doing today instead of buying from you?"
          onAssist={setAssistTarget}
        />
      </Section>

      <Section title="Value Proposition" subtitle="Unique mechanism, outcomes, and proof.">
        <Field
          label="Unique mechanism"
          name="unique_mechanism"
          defaultValue={project.unique_mechanism}
          placeholder="The 'how' behind your promise — a named framework, method, or system."
          hint="Do you have a name for your method or process? If not, describe the specific steps or approach you use that's different from the usual way people do this."
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="Core promise"
          name="core_promise"
          defaultValue={project.core_promise}
          placeholder="What one outcome do you guarantee?"
          hint="If you had to promise just ONE result, what would it be? Keep it to one sentence."
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="Top outcomes / benefits"
          name="outcomes"
          defaultValue={project.outcomes}
          placeholder="Bullet list of results the buyer gets."
          hint="A simple list of results someone actually gets is fine — it doesn't need to be polished."
          required
          onAssist={setAssistTarget}
        />
        <Field
          label="Proof available"
          name="proof"
          defaultValue={project.proof}
          placeholder="Testimonials, case studies, credentials, data, media — used verbatim, never invented."
          onAssist={setAssistTarget}
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
            hint="Even a rough number helps — without it, the AI has to guess."
            required
            onAssist={setAssistTarget}
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
        <Field
          label="Guarantee"
          name="guarantee"
          defaultValue={project.guarantee}
          placeholder="Money-back? Results-based? Describe it."
          onAssist={setAssistTarget}
        />
        <Field
          label="Bonuses (if any)"
          name="bonuses"
          defaultValue={project.bonuses}
          placeholder="List each bonus and its perceived value."
          onAssist={setAssistTarget}
        />
        <Field
          label="Scarcity / urgency"
          name="scarcity_urgency"
          defaultValue={project.scarcity_urgency}
          placeholder="Deadlines, seat limits, price increases, cohort dates."
          onAssist={setAssistTarget}
        />
        <Field
          label="Primary call to action"
          name="cta"
          defaultValue={project.cta}
          textarea={false}
          placeholder="e.g. Book a call, Buy now, Apply today"
          hint="What do you want someone to actually DO after seeing this?"
          required
          onAssist={setAssistTarget}
        />
        <div>
          <Label htmlFor="funnel_type">Funnel type</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            What does that CTA actually lead to? This determines the right copy for your Thank
            You Page — a booked call, a purchase, and a webinar registration each need a
            genuinely different confirmation page.
          </p>
          <select
            id="funnel_type"
            name="funnel_type"
            defaultValue={project.funnel_type}
            className="mt-1 flex h-9 w-full rounded-md border border-input bg-input/30 px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <option value="">Select...</option>
            {FUNNEL_TYPES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
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
        {state && "success" in state && state.success && (
          <span className="text-sm text-emerald-400">
            Saved.
            {"missing" in state && state.missing && state.missing.length > 0 && (
              <span className="text-muted-foreground"> Still need before you can generate: {state.missing.join(", ")}.</span>
            )}
          </span>
        )}
        {state && "error" in state && state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>

      <details className="pt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground">Delete project</summary>
        <div className="mt-2">
          <DeleteProjectButton projectId={project.id} projectName={project.name} trigger="text" />
        </div>
      </details>

      <DiscoveryAssistDialog
        target={assistTarget}
        onOpenChange={(open) => !open && setAssistTarget(null)}
        projectId={project.id}
        otherAnswers={collectOtherAnswers}
        onAccept={handleAssistAccept}
      />

      <WebsiteImportDialog
        open={websiteImportOpen}
        onOpenChange={setWebsiteImportOpen}
        projectId={project.id}
        currentValues={collectOtherAnswers}
        onAccept={handleWebsiteImportAccept}
      />

      <OfferBuilderDialog
        open={offerBuilderOpen}
        onOpenChange={setOfferBuilderOpen}
        projectId={project.id}
        currentValues={collectOtherAnswers}
        onAccept={handleWebsiteImportAccept}
      />
    </form>
  );
}
