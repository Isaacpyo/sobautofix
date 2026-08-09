export default function NotificationsLoading() {
  return <div role="status" aria-label="Loading notifications" className="grid animate-pulse gap-5"><div className="h-10 w-72 rounded bg-[#DCE3EA]" /><div className="grid gap-4 sm:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-36 rounded-2xl bg-[#E4EAF0]" />)}</div><div className="h-64 rounded-2xl bg-[#E4EAF0]" /></div>;
}
