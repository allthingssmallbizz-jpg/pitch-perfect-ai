"use client";

import { ExternalLink, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadHtmlFile, openInBrowserTab } from "@/lib/browserFile";

export default function WebsiteRowActions({ content, filename }: { content: string; filename: string }) {
  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => openInBrowserTab(content)}
        title="Open in a new browser tab"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => downloadHtmlFile(filename, content)}
        title="Download HTML"
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <FileDown className="h-4 w-4" />
      </Button>
    </>
  );
}
