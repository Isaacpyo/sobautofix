function SkeletonBlock({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-lg bg-[#E4EAF0] ${className}`} />;
}

export default function AdminLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading admin page"
      className="animate-pulse"
    >
      <span className="sr-only">Loading admin page</span>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="w-full max-w-sm">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="mt-3 h-10 w-56 max-w-full" />
        </div>
        <SkeletonBlock className="h-11 w-32 rounded-xl" />
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="rounded-2xl border border-[#E4EAF0] bg-white p-6">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-5 h-9 w-16" />
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-[#E4EAF0] bg-white">
        <div className="flex items-center justify-between gap-4 border-b border-[#E4EAF0] bg-[#F8FAFC] px-5 py-4">
          <SkeletonBlock className="h-4 w-36" />
          <SkeletonBlock className="h-4 w-20" />
        </div>
        <div className="divide-y divide-[#E4EAF0]">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="grid gap-4 px-5 py-5 sm:grid-cols-[1.4fr_.8fr_.6fr] sm:items-center">
              <div>
                <SkeletonBlock className="h-4 w-48 max-w-full" />
                <SkeletonBlock className="mt-2 h-3 w-32 max-w-[70%]" />
              </div>
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="h-7 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
