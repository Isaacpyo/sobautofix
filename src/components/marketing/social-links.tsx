import type { SocialLinksConfig } from "@/config/site";

type SocialPlatform = keyof SocialLinksConfig;

const platforms: Array<{ key: SocialPlatform; label: string; icon: React.ReactNode }> = [
  {
    key: "facebook",
    label: "Facebook",
    icon: <path d="M9.1 23.69V13.38H5.63V9.34H9.1V6.4c0-3.43 2.09-5.3 5.15-5.3 1.46 0 2.72.11 3.09.16v3.58h-2.12c-1.66 0-1.98.79-1.98 1.95v2.55h3.97l-.52 4.04h-3.45v10.31H9.1Z" />,
  },
  {
    key: "instagram",
    label: "Instagram",
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.5" cy="6.5" r="1" />
      </>
    ),
  },
  {
    key: "tiktok",
    label: "TikTok",
    icon: <path d="M12.53.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03a10.6 10.6 0 0 1-4.2-.97c-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75a7.25 7.25 0 0 1-1.35 3.94 7.31 7.31 0 0 1-5.91 3.21 7.13 7.13 0 0 1-4.08-1.03 7.3 7.3 0 0 1-3.65-5.72c-.02-.5-.03-1-.01-1.49a7.24 7.24 0 0 1 2.2-5.19 7.48 7.48 0 0 1 5.84-2.82c.03 1.48-.04 2.96-.04 4.44a3.4 3.4 0 0 0-3.11.35 3.34 3.34 0 0 0-1.42 1.83c-.22.53-.16 1.11-.15 1.67.24 1.64 1.82 3.02 3.5 2.87a3.5 3.5 0 0 0 2.75-1.6c.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07Z" />,
  },
  {
    key: "youtube",
    label: "YouTube",
    icon: <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.3 3.6-6.3 3.6Z" />,
  },
  {
    key: "x",
    label: "X",
    icon: <path d="M18.9 2H22l-6.8 7.8L23.2 22H17l-4.9-6.4L6.5 22H3.4l7.2-8.3L2.9 2h6.4l4.4 5.8L18.9 2Zm-1.1 17.9h1.7L8.4 4H6.6l11.2 15.9Z" />,
  },
];

export function SocialLinks({
  socials,
  showLabels = false,
  className = "",
}: {
  socials: SocialLinksConfig;
  showLabels?: boolean;
  className?: string;
}) {
  const enabledPlatforms = platforms.filter((platform) => socials[platform.key]);

  if (enabledPlatforms.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-3 ${className}`.trim()}>
      {enabledPlatforms.map((platform) => (
        <a
          key={platform.key}
          href={socials[platform.key] ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`SOB Autofix on ${platform.label}`}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-current/25 px-3 text-sm font-bold transition hover:border-[#1974E2] hover:bg-[#1974E2] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#67B9FF] ${showLabels ? "min-w-32" : "min-w-11"}`}
        >
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 fill-current" aria-hidden="true">
            {platform.icon}
          </svg>
          {showLabels && <span>{platform.label}</span>}
        </a>
      ))}
    </div>
  );
}
