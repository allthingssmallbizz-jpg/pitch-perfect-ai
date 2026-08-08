import { BookOpen, Copy } from "lucide-react";
import { TEMPLATES } from "@/lib/templates";
import { AGENTS } from "@/lib/agents/config";
import { createProjectFromTemplate } from "@/lib/actions/projects";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function TemplatesPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
          <BookOpen className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-gradient-silver">Swipe file &amp; templates</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pre-filled example briefs for common situations. Clone one, tweak the details in the
            discovery form, then generate.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TEMPLATES.map((t) => {
          const agent = AGENTS[t.assetType];
          return (
            <div key={t.id} className="card-elevated flex flex-col rounded-2xl p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs uppercase tracking-wider text-primary/80">{t.category}</span>
                <Badge variant="secondary" className="shrink-0">
                  {agent.emoji} {agent.name.replace("Agent ", "")}
                </Badge>
              </div>
              <h3 className="font-display text-lg font-semibold">{t.name}</h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{t.description}</p>

              <div className="mt-4 space-y-1.5 text-sm">
                <div className="truncate text-muted-foreground">
                  <span className="font-medium text-foreground">Offer:</span> {t.answers.product}
                </div>
                <div className="truncate text-muted-foreground">
                  <span className="font-medium text-foreground">Promise:</span> {t.answers.core_promise}
                </div>
              </div>

              <form action={createProjectFromTemplate} className="mt-5">
                <input type="hidden" name="templateId" value={t.id} />
                <Button type="submit" className="w-full">
                  <Copy className="mr-2 h-4 w-4" />
                  Use this template
                </Button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
