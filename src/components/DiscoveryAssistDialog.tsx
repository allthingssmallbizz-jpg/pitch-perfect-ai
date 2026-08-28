"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles, Loader2, Check, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { DiscoveryFieldType } from "@/lib/ai/discoveryAssist";

export type AssistTarget = {
  key: string;
  label: string;
  type: DiscoveryFieldType;
  placeholder?: string;
  options?: string[];
};

const EXAMPLES: Record<string, string> = {
  presenter_ihelp_audience: "e.g. 'Retired teachers who want a second income' or 'B2B sales managers'",
  presenter_ihelp_outcome: "e.g. 'Book their first 5 coaching clients' or 'launch a course without tech overwhelm'",
  presenter_ihelp_mechanism: "e.g. 'a done-for-you webinar funnel' or 'my 90-day group program'",
  business_name: "e.g. 'I run a coaching business helping female founders scale to 7 figures'",
  industry: "e.g. 'I coach real estate agents who are stuck under $100k/yr'",
  product: "e.g. '12-week group program, weekly calls, private community, done-for-you scripts'",
  audience: "e.g. 'Overwhelmed moms 30-45 trying to lose baby weight, tried keto, hate the gym'",
  pain_points: "e.g. 'They feel invisible at work, passed over for promotions, imposter syndrome'",
  desired_transformation: "e.g. 'Confident, respected, promoted to director in 12 months'",
  unique_mechanism: "e.g. 'I use a 3-step nervous system reset before any mindset work'",
  core_promise: "e.g. 'Book 10 qualified sales calls in 30 days without paid ads'",
  outcomes: "e.g. 'Sleep 8 hrs, drop 15 lbs, no cravings, energy back'",
  enemy: "e.g. 'The old-school guru approach that says just hustle harder'",
};

export default function DiscoveryAssistDialog({
  target,
  onOpenChange,
  projectId,
  otherAnswers,
  onAccept,
}: {
  target: AssistTarget | null;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  otherAnswers: () => Record<string, string>;
  onAccept: (key: string, text: string) => void;
}) {
  const [userPrompt, setUserPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");

  function reset() {
    setUserPrompt("");
    setDraft("");
    setLoading(false);
  }

  async function run() {
    if (!target) return;
    setLoading(true);
    try {
      const res = await fetch("/api/discovery/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          fieldKey: target.key,
          fieldLabel: target.label,
          fieldType: target.type,
          fieldPlaceholder: target.placeholder,
          options: target.options,
          userPrompt,
          otherAnswers: otherAnswers(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "AI assist failed");
      setDraft(data.text);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AI assist failed");
    } finally {
      setLoading(false);
    }
  }

  function accept() {
    if (!target) return;
    onAccept(target.key, draft);
    onOpenChange(false);
    reset();
    toast.success("Answer inserted");
  }

  const placeholder =
    (target && EXAMPLES[target.key]) ??
    "Tell the AI in plain language what your business or situation is. Even one sentence works — the AI will turn it into a professional answer.";

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI Assist — {target?.label}
          </DialogTitle>
          <DialogDescription>
            Describe your situation in plain words — or leave it blank and the AI will use your
            other answers. Either way, you get a professional draft you can edit before using it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Tell the AI about your business / situation</Label>
            <Textarea
              rows={4}
              placeholder={placeholder}
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              className="mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Tip: you can leave this blank — the AI will use your other discovery answers to draft something.
            </p>
          </div>

          {draft && (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <div className="mb-2 text-xs font-medium text-muted-foreground">AI DRAFT (edit before accepting):</div>
              <Textarea rows={6} value={draft} onChange={(e) => setDraft(e.target.value)} className="bg-background" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {!draft ? (
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
              Generate answer
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={run} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Try again
              </Button>
              <Button onClick={accept}>
                <Check className="mr-2 h-4 w-4" />
                Use this answer
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
