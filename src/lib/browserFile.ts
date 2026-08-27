// Client-only file helpers shared by every place that lets someone download or preview a
// generated HTML page — GenerateClient's own toolbar and the account-level "My Websites" list
// (src/app/(app)/websites/page.tsx) both need the exact same two behaviors, so they live here
// once instead of being copy-pasted per component.

export function downloadHtmlFile(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// A real browser tab has none of the sandboxed iframe's restrictions — the only way to see
// precisely how the page will actually behave/render for a real visitor, full-width, with
// nothing else on screen. The blob URL is revoked after the new tab has had time to load it.
export function openInBrowserTab(html: string) {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
