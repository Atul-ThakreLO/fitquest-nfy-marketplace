import Link from 'next/link'

export function Footer() {
  return (
    <footer className="mt-auto border-t border-white/8 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <p className="flex items-center gap-2">
            <span>🗺️</span>
            <span className="font-medium text-zinc-400">TerritoryNFT</span>
            <span>— Conquer the map, one tile at a time.</span>
          </p>
          <div className="flex items-center gap-4">
            <Link href="/auction" className="hover:text-zinc-300 transition-colors">Auctions</Link>
            <a href="https://sepolia.basescan.org" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300 transition-colors">Basescan</a>
          </div>
        </div>
      </div>
    </footer>
  )
}
