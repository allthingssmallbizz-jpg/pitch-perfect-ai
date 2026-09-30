// Small attribution tag, pinned to the bottom-left corner regardless of page content height —
// shown on the public marketing pages (homepage, /login, /signup, /forgot-password), not
// site-wide inside the logged-in app.
export default function CreatorTag() {
  return (
    <div className="fixed bottom-4 left-4 z-10 text-[11px] text-muted-foreground/60">
      Pitch Perfect AI created by Aaron Bowe, The AI Outlaw
    </div>
  );
}
