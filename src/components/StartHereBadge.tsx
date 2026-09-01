// A member logged in and asked "what do I do, where do I start?" — this is the answer, made
// impossible to miss: a pulsating "Start Here" badge next to Bio (the sidebar link and the /bio
// page itself) that only shows while the bio is still empty, and disappears the moment it's
// filled in. The ping ring + solid dot combo is the same "something needs your attention right
// now" language as a live-notification indicator, deliberately louder than the app's usual quiet
// muted-gray badges.
export default function StartHereBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-red-600 py-0.5 pl-1.5 pr-2 text-[10px] font-bold uppercase tracking-wide text-white ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      Start Here
    </span>
  );
}
