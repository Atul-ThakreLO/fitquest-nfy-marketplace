import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import { Navbar }       from '@/components/layout/Navbar'
import { Footer }       from '@/components/layout/Footer'
import './globals.css'
import dynamic from 'next/dynamic'


const Web3Provider = dynamic(
  () => import('@/components/providers/Web3Provider').then(m => m.Web3Provider),
  { ssr: false }
)

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Territory NFT Marketplace',
  description: 'Browse, buy, sell, and auction Territory NFTs — conquer the map.',
  openGraph: {
    title: 'Territory NFT Marketplace',
    description: 'Conquer geographic territories as unique NFTs on Base.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} flex flex-col min-h-screen`}>
        <Web3Provider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
          <Toaster position="bottom-right" theme="dark" richColors />
        </Web3Provider>
      </body>
    </html>
  )
}
