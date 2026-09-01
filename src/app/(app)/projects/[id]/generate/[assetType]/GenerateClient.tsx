"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import type { AssetType, GenerationMode } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Copy,
  FileDown,
  Save,
  Loader2,
  Trash2,
  History,
  Eye,
  Code2,
  ExternalLink,
  Palette,
  Undo2,
  Globe,
  Rocket,
  PartyPopper,
  Pencil,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import RichTextEditor from "@/components/RichTextEditor";
import VersionHistory from "@/components/VersionHistory";
import TtsPlayer from "@/components/TtsPlayer";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import {
  CSS_COLOR_VARS,
  extractCssColorVars,
  looksLikeHtmlDocument,
  replaceCssColorVar,
  WEB_PAGE_ASSET_TYPES,
  buildEditableHtml,
  INLINE_EDITOR_MESSAGE_SOURCE,
} from "@/lib/ai/generators/htmlPage";
import { downloadHtmlFile, openInBrowserTab } from "@/lib/browserFile";
import { getPublicSiteUrl } from "@/lib/publishing";
import type { PageStats } from "@/lib/analytics";
import PageEditPanel from "./PageEditPanel";

export type PastGeneration = { id: string; createdAt: string; preview: string };

// Landing Page and Thank You Page are the generators whose content is a real HTML document, not
// markdown — used both to build a clean preview snippet (raw tags would otherwise show up as
// literal text in the "Past generations" list) and client-side for the .html download filename/blob.
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

// Instant, no-regeneration color editing: every HTML-page generator declares its palette as 4 CSS
// custom properties (see htmlPage.ts), so changing a color here is a plain string replace in the
// saved HTML — no AI call, no trip back to the Brand Voice page, no losing the rest of the page.
// Each swatch carries its own undo stack (see the history/onBeginEdit/onUndo plumbing in
// GenerateClient) so trying a color that turns out wrong is never a dead end — one click restores
// whatever it was before, no need to remember or retype the old hex value.
function ColorVarEditor({
  vars,
  history,
  onChange,
  onBeginEdit,
  onUndo,
}: {
  vars: Record<string, string>;
  history: Record<string, string[]>;
  onChange: (varName: string, hex: string) => void;
  onBeginEdit: (varName: string) => void;
  onUndo: (varName: string) => void;
}) {
  return (
    <div className="card-elevated rounded-xl p-4">
      <p className="mb-3 flex items-center gap-1.5 text-sm font-medium">
        <Palette className="h-4 w-4" />
        Quick colors — change instantly, no regenerating
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CSS_COLOR_VARS.map(({ name, label }) => {
          const value = vars[name] ?? "#888888";
          const swatchValue = HEX_COLOR_PATTERN.test(value) ? value : "#888888";
          const canUndo = (history[name]?.length ?? 0) > 0;
          return (
            <div key={name}>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-xs text-muted-foreground">{label}</label>
                <button
                  type="button"
                  onClick={() => onUndo(name)}
                  disabled={!canUndo}
                  title={canUndo ? "Undo — go back to the previous color" : "No previous color to undo to yet"}
                  className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Undo2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label={`${label} picker`}
                  value={swatchValue}
                  onFocus={() => onBeginEdit(name)}
                  onChange={(e) => onChange(name, e.target.value)}
                  className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
                />
                <input
                  value={value}
                  onFocus={() => onBeginEdit(name)}
                  onChange={(e) => onChange(name, e.target.value)}
                  className="h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-xs"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Everything needed to make this page a real, publicly reachable website with no hosting account
// and no DNS — the HTML already lives in the database; Publish just assigns a slug and flips a
// flag so /site/[slug] (a fully public route) can serve it. Unpublishing keeps the slug, so
// republishing later brings back the exact same link instead of generating a new one.
function PublishPanel({
  publishedAt,
  liveUrl,
  publishing,
  onToggle,
  onCopy,
  copied,
}: {
  publishedAt: string | null;
  liveUrl: string | null;
  publishing: boolean;
  onToggle: () => void;
  onCopy: () => void;
  copied: boolean;
}) {
  const isLive = Boolean(publishedAt);
  return (
    <div className={`card-elevated rounded-xl p-4 ${isLive ? "border-emerald-500/30" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isLive ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"
          }`}
        >
          <Globe className="h-3.5 w-3.5" />
          {isLive ? "Live" : "Not published"}
        </span>
        {isLive && liveUrl && (
          <>
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
            >
              {liveUrl}
            </a>
            <Button variant="outline" size="sm" onClick={onCopy}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {copied ? "Copied!" : "Copy link"}
            </Button>
          </>
        )}
        <Button
          variant={isLive ? "outline" : "default"}
          size="sm"
          className={isLive ? "" : "ml-auto"}
          onClick={onToggle}
          disabled={publishing}
        >
          {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Rocket className="mr-2 h-4 w-4" />}
          {publishing ? "Working..." : isLive ? "Unpublish" : "Publish — go live"}
        </Button>
      </div>
      {!isLive && (
        <p className="mt-2 text-xs text-muted-foreground">
          No hosting account or coding needed — this makes the page above reachable at a real,
          public link instantly.
        </p>
      )}
    </div>
  );
}

// Basic performance numbers for a published page — views come from every /site/[slug] load,
// leads from form submissions (see src/lib/analytics.ts). Shown even pre-publish (as zeros/dashes)
// so the panel doesn't just appear out of nowhere the first time someone hits Publish.
function PageStatsPanel({
  stats,
  refreshing,
  onRefresh,
}: {
  stats: PageStats;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="card-elevated rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <BarChart3 className="h-4 w-4" />
          Page performance
        </p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="font-display text-xl font-semibold">{stats.views}</div>
          <div className="text-xs text-muted-foreground">Views</div>
        </div>
        <div>
          <div className="font-display text-xl font-semibold">{stats.leads}</div>
          <div className="text-xs text-muted-foreground">Leads</div>
        </div>
        <div>
          <div className="font-display text-xl font-semibold">
            {stats.conversionPct === null ? "—" : `${stats.conversionPct}%`}
          </div>
          <div className="text-xs text-muted-foreground">Conversion</div>
        </div>
      </div>
    </div>
  );
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function GenerateClient({
  projectId,
  assetType,
  mode,
  initialContent,
  initialGenerationId,
  projectFunnelType,
  initialPublishSlug,
  initialPublishedAt,
  initialStats,
  initialPastGenerations,
}: {
  projectId: string;
  assetType: AssetType;
  mode: GenerationMode;
  initialContent: string | null;
  initialGenerationId: string | null;
  // Only meaningful on the Landing Page screen — drives the "set it first" hint next to
  // "Generate matching Thank You Page" below, since that's what the Thank You Page generator
  // branches its copy on (see src/lib/funnelType.ts and thankYouPage.ts).
  projectFunnelType: string;
  initialPublishSlug: string | null;
  initialPublishedAt: string | null;
  initialStats: PageStats | null;
  initialPastGenerations: PastGeneration[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  function urlWithGeneration(genId?: string | null) {
    return genId ? `${pathname}?generationId=${genId}` : pathname;
  }
  const isWebPageAsset = WEB_PAGE_ASSET_TYPES.includes(assetType);
  const downloadFilename = assetType === "thank_you_page" ? "thank-you-page.html" : "landing-page.html";
  const [content, setContent] = useState<string | null>(initialContent);
  const [generationId, setGenerationId] = useState<string | null>(initialGenerationId);
  const [loading, setLoading] = useState(false);
  // Longer generators (PPT Outline's 60-90 slides especially) can genuinely take a few minutes —
  // Claude auto-continues in several sequential calls once it hits the per-call output cap. With
  // no feedback beyond a static "Building..." message, a run that's still legitimately working
  // looks identical to one that's silently hung, which is exactly what prompted this. Ticks once
  // a second only while a run is in flight; the tiered copy below reassures instead of describing
  // any real progress, since there's no per-slide progress signal to report.
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  // Shares this timer/tiered-copy with generateWebinarNow's and createScriptNow's loading states
  // below (the "Generate Your Webinar Now" action from a Webinar Blueprint, and "Create Script"
  // from Your Webinar) — same slow, multi-call generation this comment already describes, just
  // triggered from different buttons.
  const [generatingWebinarDeck, setGeneratingWebinarDeck] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  useEffect(() => {
    if (!loading && !generatingWebinarDeck && !generatingScript) return;
    const interval = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(interval);
  }, [loading, generatingWebinarDeck, generatingScript]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pastGenerations, setPastGenerations] = useState<PastGeneration[]>(initialPastGenerations);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Web-page assets' content is a real HTML document — default to seeing it rendered as an
  // actual page. "inline" is a live, click-to-edit rendering of that same page (see
  // buildEditableHtml); "html" is the raw-source textarea, the power-user fallback.
  const [viewMode, setViewMode] = useState<"preview" | "inline" | "html">("preview");
  const inlineIframeRef = useRef<HTMLIFrameElement>(null);

  const colorVars = useMemo(() => (content && isWebPageAsset ? extractCssColorVars(content) : null), [content, isWebPageAsset]);
  // One undo stack per CSS color variable (keyed by "--pp-primary" etc.) — a plain array of
  // previous hex values, most recent last. pendingPreviousColorRef tracks "the value this swatch
  // had when the current edit session started" so a color-picker drag (which fires many onChange
  // events in a row) or fast typing only pushes ONE history entry per session, not one per pixel
  // dragged — recorded via onFocus (beginColorEdit) below, consumed by the first onChange after.
  const [colorHistory, setColorHistory] = useState<Record<string, string[]>>({});
  const pendingPreviousColorRef = useRef<Record<string, string | null>>({});

  const [publishSlug, setPublishSlug] = useState<string | null>(initialPublishSlug);
  const [publishedAt, setPublishedAt] = useState<string | null>(initialPublishedAt);
  const [publishing, setPublishing] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const liveUrl = publishSlug ? getPublicSiteUrl(publishSlug) : null;

  const [stats, setStats] = useState<PageStats | null>(initialStats);
  const [statsRefreshing, setStatsRefreshing] = useState(false);
  async function refreshStats() {
    if (!generationId) return;
    setStatsRefreshing(true);
    try {
      const res = await fetch(`/api/generations/${generationId}/stats`);
      if (res.ok) setStats(await res.json());
    } catch {
      // best-effort — leave the previous numbers showing
    } finally {
      setStatsRefreshing(false);
    }
  }

  const autosave = useDebouncedCallback((newContent: string, id: string) => {
    fetch(`/api/generations/${id}/autosave`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newContent }),
    }).catch(() => {});
  }, 1200);

  // Listens for edits made directly in the "Edit inline" iframe (see buildEditableHtml's
  // injected script) and folds them back into this page's content exactly like any other edit —
  // same state update, same autosave. `e.source` is checked against the specific iframe's own
  // contentWindow so a message from anything else in the page (a browser extension, etc.) can
  // never be mistaken for a real edit.
  useEffect(() => {
    function handleInlineEdit(e: MessageEvent) {
      if (!e.data || e.data.source !== INLINE_EDITOR_MESSAGE_SOURCE) return;
      if (e.source !== inlineIframeRef.current?.contentWindow) return;
      const html = e.data.html;
      if (typeof html !== "string") return;
      setContent(html);
      setSaved(false);
      if (generationId) autosave(html, generationId);
    }
    window.addEventListener("message", handleInlineEdit);
    return () => window.removeEventListener("message", handleInlineEdit);
  }, [generationId, autosave]);

  function handleEditorChange(markdown: string) {
    setContent(markdown);
    setSaved(false);
    if (generationId) autosave(markdown, generationId);
  }

  // Called on focus of either input for a swatch — snapshots "the color right now, before this
  // edit session touches it" into a ref (not state) so it doesn't itself trigger a re-render, and
  // so a drag/typing session that fires many onChange events only records ONE undo entry (the
  // ref is cleared to null the first time it's consumed, in updateColorVar below).
  function beginColorEdit(varName: string) {
    if (!colorVars) return;
    pendingPreviousColorRef.current[varName] = colorVars[varName] ?? null;
  }

  function updateColorVar(varName: string, hex: string) {
    if (!content) return;
    const pendingPrevious = pendingPreviousColorRef.current[varName];
    if (pendingPrevious && pendingPrevious !== hex) {
      setColorHistory((prev) => ({ ...prev, [varName]: [...(prev[varName] ?? []), pendingPrevious] }));
      pendingPreviousColorRef.current[varName] = null;
    }
    const updated = replaceCssColorVar(content, varName, hex);
    setContent(updated);
    setSaved(false);
    if (generationId) autosave(updated, generationId);
  }

  function undoColorVar(varName: string) {
    if (!content) return;
    const history = colorHistory[varName];
    if (!history || history.length === 0) return;
    const previous = history[history.length - 1];
    const updated = replaceCssColorVar(content, varName, previous);
    setContent(updated);
    setColorHistory((prev) => ({ ...prev, [varName]: prev[varName].slice(0, -1) }));
    pendingPreviousColorRef.current[varName] = null;
    setSaved(false);
    if (generationId) autosave(updated, generationId);
  }

  async function togglePublish() {
    if (!generationId) return;
    setPublishing(true);
    try {
      const goingLive = !publishedAt;
      if (goingLive && content !== null) {
        // Autosave already debounces content edits (color tweaks, HTML edits) — this makes sure
        // whatever's about to go live is exactly what's on screen right now, not a slightly
        // stale version still waiting out that debounce window.
        await fetch(`/api/generations/${generationId}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        });
      }
      const res = await fetch(`/api/generations/${generationId}/${goingLive ? "publish" : "unpublish"}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not update publish status.");
      if (goingLive) {
        setPublishSlug(data.slug);
        setPublishedAt(new Date().toISOString());
        toast.success("Live! Your page is now public.");
      } else {
        setPublishedAt(null);
        toast.success("Unpublished.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update publish status.");
    } finally {
      setPublishing(false);
    }
  }

  async function copyLiveLink() {
    if (!liveUrl) return;
    await navigator.clipboard.writeText(liveUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  const [generatingMatch, setGeneratingMatch] = useState(false);

  // Called from the Landing Page screen only — generates a Thank You Page in this SAME project
  // (the normal /api/generate call, just for the other asset type) instead of sending someone
  // through "start a new project," which would create an unrelated Thank You Page with no
  // guaranteed visual connection to this Landing Page at all. formatPriorGenerationsBlock already
  // feeds the Landing Page's copy into the Thank You Page prompt for narrative consistency, but
  // colors are forced to match exactly afterward here rather than trusted to the AI/brand-voice
  // palette landing on the identical hex values by chance — the two pages have to look like the
  // same site, not just a similar one.
  async function generateMatchingThankYouPage() {
    if (!content) return;
    setGeneratingMatch(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, assetType: "thank_you_page", mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate the Thank You Page.");

      const sourceColors = extractCssColorVars(content);
      let matchedContent = String(data.content);
      if (sourceColors) {
        for (const { name } of CSS_COLOR_VARS) {
          const hex = sourceColors[name];
          if (hex) matchedContent = replaceCssColorVar(matchedContent, name, hex);
        }
        await fetch(`/api/generations/${data.generationId}/autosave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: matchedContent }),
        });
      }

      toast.success("Matching Thank You Page created!");
      router.push(`/projects/${projectId}/generate/thank_you_page?generationId=${data.generationId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate the Thank You Page.");
    } finally {
      setGeneratingMatch(false);
    }
  }

  // Same "generate the paired asset in this same project, then jump straight to it" pattern as
  // generateMatchingThankYouPage above, for the other half of this app's one asymmetric-but-
  // linked pair: a Webinar Blueprint (Sarah) isn't the presentable deck, Your Webinar (Polly) is
  // — see the rename/pointer work this followed from. webinarPromptOpen (below) is what opens
  // automatically right after a fresh blueprint finishes generating (the "what's next?" moment);
  // generatingWebinarDeck lives up with `loading`/`elapsedSeconds` since it shares that timer.
  const [webinarPromptOpen, setWebinarPromptOpen] = useState(false);

  async function generateWebinarNow() {
    setWebinarPromptOpen(false);
    setGeneratingWebinarDeck(true);
    setElapsedSeconds(0);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, assetType: "ppt_outline", mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not generate your webinar.");
      router.push(`/projects/${projectId}/generate/ppt_outline?generationId=${data.generationId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not generate your webinar.");
    } finally {
      setGeneratingWebinarDeck(false);
    }
  }

  // Same chained-generation pattern one more time, one step further: Your Webinar (the slide
  // deck) isn't a script either — "so what do I actually say on each slide?" is the very next
  // question a member asks once the deck exists. scriptPromptOpen fires automatically right after
  // a fresh deck finishes generating; generatingScript lives up with `loading`/`elapsedSeconds`.
  const [scriptPromptOpen, setScriptPromptOpen] = useState(false);

  async function createScriptNow() {
    setScriptPromptOpen(false);
    setGeneratingScript(true);
    setElapsedSeconds(0);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, assetType: "webinar_script", mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not create your script.");
      router.push(`/projects/${projectId}/generate/webinar_script?generationId=${data.generationId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create your script.");
    } finally {
      setGeneratingScript(false);
    }
  }

  async function run() {
    setLoading(true);
    setElapsedSeconds(0);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, assetType, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Generation failed.");
        return;
      }
      setContent(data.content);
      setGenerationId(data.generationId);
      if (assetType === "webinar_outline") setWebinarPromptOpen(true);
      if (assetType === "ppt_outline") setScriptPromptOpen(true);
      // A fresh generation is a brand-new row — never already published under this id.
      setPublishSlug(null);
      setPublishedAt(null);
      const previewSource = isWebPageAsset ? stripHtmlTags(String(data.content)) : String(data.content).replace(/\s+/g, " ").trim();
      setPastGenerations((prev) => [
        { id: data.generationId, createdAt: new Date().toISOString(), preview: previewSource.slice(0, 120) },
        ...prev,
      ]);
      // A plain browser History API call, not router.replace() — this page reads searchParams
      // server-side, so router.replace() would force Next.js to re-fetch and re-render the
      // whole server tree for the route right after we just set the freshly-generated content
      // in local state, racing against it (and, worse, potentially racing the database write
      // that just happened — a stale re-read could reflect the row before it finished saving).
      // All this needs to do is update the address bar so a refresh doesn't lose track of which
      // generation is showing; it doesn't need — and must not trigger — any re-render.
      window.history.replaceState(null, "", urlWithGeneration(data.generationId));
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  function openPast(pastId: string) {
    router.push(urlWithGeneration(pastId));
  }

  async function deletePast(pastId: string) {
    if (!window.confirm("Delete this generation? This can't be undone.")) return;
    setDeletingId(pastId);
    try {
      const res = await fetch(`/api/generations/${pastId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Could not delete.");
      }
      setPastGenerations((prev) => prev.filter((g) => g.id !== pastId));
      if (generationId === pastId) {
        setContent(null);
        setGenerationId(null);
        setPublishSlug(null);
        setPublishedAt(null);
        router.replace(urlWithGeneration());
      }
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setDeletingId(null);
    }
  }

  async function saveVersion() {
    if (!generationId || content === null) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/generations/${generationId}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Could not save.");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  // The edit route already persisted the update directly to the DB row — this just reflects it
  // in local state, no autosave round-trip needed.
  function handleAiEditApplied(newContent: string) {
    setContent(newContent);
    setSaved(false);
  }

  async function copyToClipboard() {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={loading}>
          <Sparkles className="mr-2 h-4 w-4" />
          {loading ? "Generating..." : content ? "Regenerate" : "Generate"}
        </Button>
        {content && (
          <>
            <Button variant="outline" onClick={copyToClipboard}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? "Copied!" : "Copy"}
            </Button>
            {generationId && (
              <>
                <Button variant="outline" onClick={saveVersion} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saved ? "Saved!" : "Save"}
                </Button>
                <VersionHistory
                  generationId={generationId}
                  currentContent={content}
                  onRestored={(restored) => setContent(restored)}
                />
                {isWebPageAsset ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => openInBrowserTab(content)}
                      disabled={!looksLikeHtmlDocument(content)}
                      title={
                        looksLikeHtmlDocument(content)
                          ? "Open in a new browser tab, full-width, exactly as a visitor would see it"
                          : "Regenerate first — this was saved before the visual redesign"
                      }
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Preview in browser
                    </Button>
                    <Button variant="outline" onClick={() => downloadHtmlFile(downloadFilename, content)}>
                      <FileDown className="mr-2 h-4 w-4" />
                      Download HTML
                    </Button>
                    {assetType === "landing_page" && (
                      <Button variant="outline" onClick={generateMatchingThankYouPage} disabled={generatingMatch}>
                        {generatingMatch ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <PartyPopper className="mr-2 h-4 w-4" />
                        )}
                        {generatingMatch ? "Building..." : "Generate matching Thank You Page"}
                      </Button>
                    )}
                  </>
                ) : (
                  <>
                    <Button variant="outline" asChild>
                      <a href={`/api/export/pdf?generationId=${generationId}`}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export PDF
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={`/api/export/docx?generationId=${generationId}`}>
                        <FileDown className="mr-2 h-4 w-4" />
                        Export .docx
                      </a>
                    </Button>
                    {assetType === "ppt_outline" && (
                      <Button variant="outline" asChild>
                        <a href={`/api/export/pptx?generationId=${generationId}`}>
                          <FileDown className="mr-2 h-4 w-4" />
                          Export .pptx (designed deck)
                        </a>
                      </Button>
                    )}
                  </>
                )}
              </>
            )}
            {isWebPageAsset && (
              <div className="ml-auto flex overflow-hidden rounded-md border border-border">
                <button
                  type="button"
                  onClick={() => setViewMode("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm ${
                    viewMode === "preview" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("inline")}
                  title="Click any text on the page and type to edit it directly"
                  className={`flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-sm ${
                    viewMode === "inline" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Pencil className="h-4 w-4" />
                  Edit inline
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("html")}
                  className={`flex items-center gap-1.5 border-l border-border px-3 py-1.5 text-sm ${
                    viewMode === "html" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Code2 className="h-4 w-4" />
                  Edit HTML
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {assetType === "ppt_outline" && content && (
        <p className="mb-4 -mt-2 text-xs text-muted-foreground">
          Heads up: <strong>Copy</strong> grabs this raw text as-is — on-slide content and speaker
          notes together, with no separation. Use <strong>Export .pptx (designed deck)</strong> to
          get a real PowerPoint file with the speaker notes correctly placed in PowerPoint&apos;s
          own Notes pane, off the visible slide.
        </p>
      )}

      {assetType === "landing_page" && content && !projectFunnelType && (
        <p className="mb-4 -mt-2 text-xs text-muted-foreground">
          Tip: set this project&apos;s{" "}
          <Link href={`/projects/${projectId}`} className="text-primary hover:underline">
            Funnel type
          </Link>{" "}
          first (Offer section) so the matching Thank You Page&apos;s copy is specific to what your CTA
          actually leads to, instead of a generic confirmation.
        </p>
      )}

      {/* This blueprint (7 strategic phases/beats) isn't the presentable deck itself — that's
          Your Signature Webinar (Agent Polly), which builds the actual 60-90 slide-by-slide deck from this
          exact blueprint. A real button rather than a quiet text link — this is meant to read as
          the obvious next step, not a footnote — plus the pop-up dialog above fires automatically
          right after a fresh blueprint finishes generating, when "what's next?" is the live
          question; this button is what stays around for anyone who dismissed that or is
          revisiting a saved blueprint later. */}
      {assetType === "webinar_outline" && content && (
        <div className="mb-4 -mt-2">
          <Button onClick={generateWebinarNow} disabled={generatingWebinarDeck}>
            {generatingWebinarDeck ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generatingWebinarDeck ? "Building your signature webinar..." : "Generate Your Signature Webinar Now"}
          </Button>
          {generatingWebinarDeck && (
            <p className="mt-2 text-xs text-muted-foreground">
              {elapsedSeconds >= 45
                ? "Still working — a full 60-90 slide deck can take a few minutes. No need to refresh."
                : elapsedSeconds >= 15
                  ? "This can take a little while for a full-length deck. Hang tight..."
                  : "Agent Polly is turning your blueprint into the full slide-by-slide deck..."}
            </p>
          )}
        </div>
      )}

      <Dialog open={webinarPromptOpen} onOpenChange={setWebinarPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your blueprint is ready!</DialogTitle>
            <DialogDescription>
              Now that we have your outline, it&apos;s time to generate your signature webinar —
              Agent Polly turns these phases into the actual 60-90 slide-by-slide presentation,
              ready to present.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWebinarPromptOpen(false)}>
              Not yet
            </Button>
            <Button onClick={generateWebinarNow}>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Your Signature Webinar Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* One step further: Your Signature Webinar's own speaker notes are short (1-3 sentences, meant for
          a Notes-pane glance) — this is the fuller, standalone talk-track for "so what do I
          actually say on each slide?", aligned 1:1 to the exact deck that already exists. Same
          real-button-plus-auto-popup pattern as the blueprint-to-deck step above. */}
      {assetType === "ppt_outline" && content && (
        <div className="mb-4 -mt-2">
          <Button onClick={createScriptNow} disabled={generatingScript}>
            {generatingScript ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            {generatingScript ? "Writing your script..." : "Create Script"}
          </Button>
          {generatingScript && (
            <p className="mt-2 text-xs text-muted-foreground">
              {elapsedSeconds >= 45
                ? "Still working — a full script for a 60-90 slide deck can take a few minutes. No need to refresh."
                : elapsedSeconds >= 15
                  ? "This can take a little while for a full-length script. Hang tight..."
                  : "Agent Polly is writing what to say on every slide..."}
            </p>
          )}
        </div>
      )}

      <Dialog open={scriptPromptOpen} onOpenChange={setScriptPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Your signature webinar is built!</DialogTitle>
            <DialogDescription>
              Now that your slides are ready, let&apos;s create your script — the exact words to
              say on every slide, aligned to the deck you just built, so you know exactly how to
              deliver it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setScriptPromptOpen(false)}>
              Not yet
            </Button>
            <Button onClick={createScriptNow}>
              <Sparkles className="mr-2 h-4 w-4" />
              Create Script
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pastGenerations.length > 0 && (
        <details className="mb-4 rounded-xl border border-border bg-card/30" open={pastGenerations.length <= 3}>
          <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <History className="mr-1.5 inline h-4 w-4" />
            Past generations from this agent ({pastGenerations.length})
          </summary>
          <ul className="divide-y divide-border/60 border-t border-border">
            {pastGenerations.map((g) => (
              <li
                key={g.id}
                className={`flex items-center gap-3 px-4 py-2.5 text-sm ${g.id === generationId ? "bg-primary/5" : ""}`}
              >
                <button onClick={() => openPast(g.id)} className="min-w-0 flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(g.createdAt)}</span>
                    {g.id === generationId && (
                      <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Viewing
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-muted-foreground">{g.preview || "(empty)"}</div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  disabled={deletingId === g.id}
                  onClick={() => deletePast(g.id)}
                  title="Delete this generation"
                >
                  {deletingId === g.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

      {loading && !content && (
        <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
          <p>Building your asset with the Pitch Perfect Method™...</p>
          {elapsedSeconds >= 15 && (
            <p className="mt-2 text-sm">
              {elapsedSeconds >= 45
                ? "Still working — longer assets like a full slide deck can take a few minutes. No need to refresh."
                : "This can take a little while for longer assets. Hang tight..."}
            </p>
          )}
        </div>
      )}

      {content && isWebPageAsset && (
        <div className="space-y-4">
          {generationId && (
            <PublishPanel
              publishedAt={publishedAt}
              liveUrl={liveUrl}
              publishing={publishing}
              onToggle={togglePublish}
              onCopy={copyLiveLink}
              copied={linkCopied}
            />
          )}
          {generationId && stats && (
            <PageStatsPanel stats={stats} refreshing={statsRefreshing} onRefresh={refreshStats} />
          )}
          {generationId && (
            <PageEditPanel generationId={generationId} content={content} onApplied={handleAiEditApplied} />
          )}
          {colorVars && (
            <ColorVarEditor
              vars={colorVars}
              history={colorHistory}
              onChange={updateColorVar}
              onBeginEdit={beginColorEdit}
              onUndo={undoColorVar}
            />
          )}
          {viewMode === "html" ? (
            <textarea
              value={content}
              onChange={(e) => handleEditorChange(e.target.value)}
              spellCheck={false}
              className="h-[600px] w-full rounded-xl border border-border/60 bg-card/40 p-4 font-mono text-xs leading-relaxed focus:outline-none"
            />
          ) : !looksLikeHtmlDocument(content) ? (
            <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
              This was generated before the visual redesign, so it&apos;s plain text, not a real
              page — click <strong>Regenerate</strong> above to get an actual designed page, or
              switch to <strong>Edit HTML</strong> to see the old content.
            </div>
          ) : viewMode === "inline" ? (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
              <p className="border-b border-border/60 bg-primary/5 px-4 py-2 text-xs text-muted-foreground">
                Click any text on the page below and start typing — changes save automatically.
              </p>
              {/* sandbox="allow-scripts" only (no allow-same-origin, no allow-forms) — this iframe
                  runs a small script WE inject (buildEditableHtml, not AI-generated) so clicking
                  text makes it directly editable, but it still can't read cookies/local storage,
                  reach this app's own origin, or submit the real opt-in form inside it. */}
              <iframe
                ref={inlineIframeRef}
                title="Edit page inline"
                srcDoc={buildEditableHtml(content)}
                sandbox="allow-scripts"
                className="h-[900px] w-full"
              />
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/60 bg-white">
              {/* sandbox with no allow-scripts/allow-same-origin — this is AI-generated markup
                  rendered inside an authenticated app, so it must not be able to run script or
                  reach this origin's session, even though the generator is instructed not to
                  include any <script> tags in the first place. */}
              <iframe
                title="Landing page preview"
                srcDoc={content}
                sandbox=""
                className="h-[900px] w-full"
              />
            </div>
          )}
        </div>
      )}

      {content && !isWebPageAsset && (
        <div className="space-y-4">
          <TtsPlayer text={content} />
          <RichTextEditor markdown={content} onChange={handleEditorChange} />
        </div>
      )}

      {!content && !loading && (
        <div className="card-elevated rounded-2xl border-dashed p-10 text-center text-muted-foreground">
          Click Generate to build this asset from your project&apos;s discovery data.
        </div>
      )}
    </div>
  );
}
