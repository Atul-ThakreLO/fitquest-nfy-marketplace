import { AuctionRoom } from '@/components/auction/AuctionRoom'

interface PageProps {
  params: { auctionId: string }
}

export function generateMetadata({ params }: PageProps) {
  return {
    title: `Auction #${params.auctionId} — Territory NFT`,
    description: `Live auction room for Territory NFT auction #${params.auctionId}. Place your bid now.`,
  }
}

export default function AuctionRoomPage({ params }: PageProps) {
  return <AuctionRoom auctionId={params.auctionId} />
}
