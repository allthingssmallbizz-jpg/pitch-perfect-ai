"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wand2, Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  OFFER_BUILDER_FIELD_KEYS,
  OFFER_BUILDER_FIELD_LABELS,
  OFFER_BUILDER_CREDIT_COST,
  type OfferBuilderFieldKey,
} from "@/lib/ai/offerBuilder";

export default function OfferBuilderDialog({
  open,
  onOpenChange,
  projectId,
  currentValues,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  // Called fresh each time, same reasoning as WebsiteImportDialog — the form's fields are
  // uncontrolled, so "current value" only exists by reading the live DOM at that moment.
  currentValues: () => Record<string, string>;
  onAccept: (values: Partial<Record<OfferBuilderFieldKey, string>>) => void;
}) {
  const [extraContext, setExtraContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Record<OfferBuilderFieldKey, string> | null>(null);
  const [pricingReasoning, setPricingReasoning] = useState("");
  const [closingMechanismReasoning, setClosingMechanismReasoning] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [alreadyFilled, setAlreadyFilled] = useState<Record<string, boolean>>({});

  function reset() {
    setExtraContext("");
    setFields(null);
    setPricingReasoning("");
    setClosingMechanismReasoning("");
    setSelected({});
    setAlreadyFilled({});
    setLoading(false);
  }

  async function run() {
    setLoading(true);
    try {
      const res = await fetch("/api/discovery/offer-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, extraContext }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Offer Builder failed");

      const existing = currentValues();
      const nextSelected: Record<string, boolean> = {};
      const nextAlreadyFilled: Record<string, boolean> = {};
      for (const key of OFFER_BUILDER_FIELD_KEYS) {
        const hasSuggestion = Boolean(data.fields[key]?.trim());
        const hasExisting = Boolean(existing[key]?.trim());
        nextAlreadyFilled[key] = hasExisting;
        nextSelected[key] = hasSuggestion && !hasExisting;
      }
      setFields(data.fields);
      setPricingReasoning(data.pricingReasoning || "");
      setClosingMechanismReasoning(data.closingMechanismReasoning || "");
      setSelected(nextSelected);
      setAlreadyFilled(nextAlreadyFilled);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Offer Builder failed");
    } finally {
      setLoading(false);
    }
  }

  function insert() {
    if (!fields) return;
    const toInsert: Partial<Record<OfferBuilderFieldKey, string>> = {};
    for (const key of OFFER_BUILDER_FIELD_KEYS) {
      if (selected[key] && fields[key]?.trim()) toInsert[key] = fields[key];
    }
    const count = Object.keys(toInsert).length;
    if (count === 0) {
      toast.error("Select at least one field to insert.");
      return;
    }
    onAccept(toInsert);
    onOpenChange(false);
    reset();
    toast.success(`Inserted ${count} field${count === 1 ? "" : "s"}`);
  }

  const suggestedKeys = fields ? OFFER_BUILDER_FIELD_KEYS.filter((k) => fields[k]?.trim()) : [];
  const selectedCount = suggestedKeys.filter((k) => selected[k]).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset();
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            Offer Builder
          </DialogTitle>
          <DialogDescription>
            Don&apos;t know what to name your webinar yet, what to charge, or how to close? This
            drafts a full starter offer from whatever you&apos;ve already filled in — review and
            tweak before anything&apos;s inserted, same as Import from your website.
          </DialogDescription>
        </DialogHeader>

        {!fields ? (
          <div className="space-y-3">
            <Textarea
              placeholder="Optional — anything specific in mind? A name idea, a price range, a format you already know you want. Leave blank and the AI will use judgment from what's filled in so far."
              value={extraContext}
              onChange={(e) => setExtraContext(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Costs {OFFER_BUILDER_CREDIT_COST} credits. Works best with at least Industry,
              Audience, and Product filled in above — the more it has, the sharper the draft.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestedKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Didn&apos;t come back with a usable draft — try again, or add a bit more context
                above.
              </p>
            ) : (
              <>
                {suggestedKeys.map((key) => (
                  <label
                    key={key}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card/30 p-3"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(selected[key])}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{OFFER_BUILDER_FIELD_LABELS[key]}</span>
                        {alreadyFilled[key] && (
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                            Already filled — will overwrite if checked
                          </span>
                        )}
                      </div>
                      <Textarea
                        value={fields[key]}
                        onChange={(e) => setFields((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
                        rows={key === "outcomes" || key === "bonuses" ? 3 : 2}
                        className="mt-1 bg-background text-sm"
                      />
                    </div>
                  </label>
                ))}

                {pricingReasoning && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                    <p className="font-medium text-foreground">Why this price?</p>
                    <p className="mt-1 text-muted-foreground">{pricingReasoning}</p>
                  </div>
                )}
                {closingMechanismReasoning && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs">
                    <p className="font-medium text-foreground">Why this closing mechanism?</p>
                    <p className="mt-1 text-muted-foreground">{closingMechanismReasoning}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {!fields ? (
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              {loading ? "Building your offer..." : "Build my offer"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                Try again
              </Button>
              {suggestedKeys.length > 0 && (
                <Button onClick={insert} disabled={selectedCount === 0}>
                  <Check className="mr-2 h-4 w-4" />
                  Insert {selectedCount} selected
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
