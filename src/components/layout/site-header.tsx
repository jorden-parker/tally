"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const PAGES = [
  { href: "/", label: "Dashboard" },
  { href: "/tickets", label: "Tickets" },
  { href: "/work", label: "Work log" },
  { href: "/settings", label: "Settings" },
];

function TallyGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-6 text-foreground"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
    >
      <path d="M5 4.5 5.4 19.5M9.2 4 9 20M13 4.6 13.3 19.4M17 4.2 16.8 19.8" />
      <path d="M2.5 15.5C8 12.5 15 9.5 21.5 7.5" className="text-reviewed" stroke="currentColor" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-3 sm:px-6">
        <Link href="/" aria-label="Tally home" className="flex w-fit items-center gap-2 rounded-md">
          <TallyGlyph />
          <span className="text-lg font-semibold tracking-tight">Tally</span>
        </Link>
        <nav aria-label="Pages" className="-mx-3 flex flex-wrap">
          {PAGES.map(({ href, label }) => {
            const isCurrent = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 pt-1.5 pb-3 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-1 after:-rotate-1 after:rounded-full after:bg-highlight after:opacity-0 after:transition-opacity",
                  isCurrent && "text-foreground after:opacity-100",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
