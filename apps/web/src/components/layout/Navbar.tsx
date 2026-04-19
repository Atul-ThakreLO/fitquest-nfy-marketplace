"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@/components/ui/ConnectButton";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Marketplace" },
  { href: "/auction", label: "Auctions" },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/8 glass">
      <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex h-16 items-center justify-between gap-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 flex-shrink-0">
          <span className="text-2xl">🗺️</span>
          <span className="font-bold text-white text-lg tracking-tight">
            Territory<span className="text-orange-400">NFT</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === href
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5",
              )}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Wallet */}
        <div className="flex gap-2 items-center">
          <ConnectButton />
          <div>
            <Link href="/profile" className={cn(
                "px-5 py-2 rounded-lg text-xl font-medium transition-colors mx-3",
                pathname === "/profile"
                  ? "bg-white/10 text-white"
                  : "text-zinc-400 hover:text-white hover:bg-white/5",
              )}>
              👤
            </Link>
          </div>
        </div>
      </nav>
    </header>
  );
}
