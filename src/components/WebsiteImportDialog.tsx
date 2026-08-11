"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Globe, Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  WEBSITE_IMPORT_FIELD_KEYS,
  WEBSITE_IMPORT_FIELD_LABELS,
  WEBSITE_IMPORT_CREDIT_COST,
  type WebsiteImportFieldKey,
} from "@/lib/ai/websiteImport";

export default function WebsiteImportDialog({
  open,
  onOpenChange,
  projectId,
  currentValues,
  onAccept,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  // Called fresh each time the dialog opens rather than passed as a static prop — the form's
  // fields are uncontrolled (defaultValue-based, see DiscoveryForm's own comment on why), so
  // "current value" only exists by reading the live DOM at that moment.
  currentValues: () => Record<string, string>;
  onAccept: (values: Partial<Record<WebsiteImportFieldKey, string>>) => void;
}) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<Record<WebsiteImportFieldKey, string> | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [alreadyFilled, setAlreadyFilled] = useState<Record<string, boolean>>({});

  function reset() {
    setUrl("");
    setFields(null);
    setSelected({});
    setAlreadyFilled({});
    setLoading(false);
  }

  async function run() {
    if (!url.trim()) {
      toast.error("Enter a website address first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/discovery/import-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");

      const existing = currentValues();
      const nextSelected: Record<string, boolean> = {};
      const nextAlreadyFilled: Record<string, boolean> = {};
      for (const key of WEBSITE_IMPORT_FIELD_KEYS) {
        const hasSuggestion = Boolean(data.fields[key]?.trim());
        const hasExisting = Boolean(existing[key]?.trim());
        nextAlreadyFilled[key] = hasExisting;
        // Only pre-check fields that are currently empty — a field you already filled in stays
        // untouched unless you explicitly opt in to overwrite it with the website's version.
        nextSelected[key] = hasSuggestion && !hasExisting;
      }
      setFields(data.fields);
      setSelected(nextSelected);
      setAlreadyFilled(nextAlreadyFilled);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  function insert() {
    if (!fields) return;
    const toInsert: Partial<Record<WebsiteImportFieldKey, string>> = {};
    for (const key of WEBSITE_IMPORT_FIELD_KEYS) {
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

  const suggestedKeys = fields ? WEBSITE_IMPORT_FIELD_KEYS.filter((k) => fields[k]?.trim()) : [];
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
            <Globe className="h-5 w-5 text-primary" />
            Import from your website
          </DialogTitle>
          <DialogDescription>
            Paste your website address — the AI reads it and drafts whichever of the fields below
            it can confidently answer. Nothing gets inserted until you review and choose which
            ones to use, and anything already filled in stays untouched unless you say otherwise.
          </DialogDescription>
        </DialogHeader>

        {!fields ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="website-import-url">Website address</Label>
              <Input
                id="website-import-url"
                placeholder="e.g. yourbusiness.com or yourbusiness.com/offer"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && run()}
                className="mt-1"
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Your homepage, &quot;about,&quot; or offer/sales page usually works best. Costs{" "}
                {WEBSITE_IMPORT_CREDIT_COST} credits per import.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestedKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                That website didn&apos;t give the AI enough to confidently answer any of these
                fields — try a different page, or fill this in manually.
              </p>
            ) : (
              suggestedKeys.map((key) => (
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
                      <span className="text-sm font-medium">{WEBSITE_IMPORT_FIELD_LABELS[key]}</span>
                      {alreadyFilled[key] && (
                        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                          Already filled — will overwrite if checked
                        </span>
                      )}
                    </div>
                    <Textarea
                      value={fields[key]}
                      onChange={(e) => setFields((prev) => (prev ? { ...prev, [key]: e.target.value } : prev))}
                      rows={2}
                      className="mt-1 bg-background text-sm"
                    />
                  </div>
                </label>
              ))
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {!fields ? (
            <Button onClick={run} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Globe className="mr-2 h-4 w-4" />}
              {loading ? "Reading your website..." : "Import from website"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={reset}>
                Try a different page
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
