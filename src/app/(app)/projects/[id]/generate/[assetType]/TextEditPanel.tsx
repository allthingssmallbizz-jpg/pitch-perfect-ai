"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TEXT_EDIT_CREDIT_COST } from "@/lib/ai/generators/textEdit";

// Course Outline's (and any future markdown generator's) equivalent of PageEditPanel — a plain
// "tell it what to add, remove, or change" box that applies a targeted edit to the already-
// generated content instead of a full regenerate, via the same /api/generations/[id]/edit
// endpoint's markdown-editable branch (see that route's TEXT_EDITABLE_ASSET_TYPES). No image/
// video handling here — none of that applies to a plain text document.
export default function TextEditPanel({
  generationId,
  onApplied,
}: {
  generationId: string;
  onApplied: (newContent: string) => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    if (!instruction.trim()) {
      toast.error("Describe what to add, remove, or change first.");
      return;
    }
    setApplying(true);
    try {
      const res = await fetch(`/api/generations/${generationId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not apply that update.");

      onApplied(data.content);
      setInstruction("");
      toast.success("Updated!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not apply that update.");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="card-elevated rounded-xl p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <Wand2 className="h-4 w-4" />
        Add, remove, or change something
      </p>
      <p className="mb-3 text-xs text-muted-foreground">
        Tell Cora exactly what to add, take out, or change in the course above — a whole module, a
        specific lesson, a rename — and only that changes. Everything else stays exactly as it is.
      </p>
      <Textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        placeholder={`e.g. "Add a module on pricing between Module 3 and Module 4" or "Remove the community accountability section" or "Rename Module 2 to 'Find Your Signature Offer'"`}
        rows={3}
        disabled={applying}
      />
      <div className="mt-3 flex justify-end">
        <Button type="button" size="sm" onClick={handleApply} disabled={applying}>
          {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
          {applying ? "Working..." : `Apply update (${TEXT_EDIT_CREDIT_COST} credits)`}
        </Button>
      </div>
    </div>
  );
}
