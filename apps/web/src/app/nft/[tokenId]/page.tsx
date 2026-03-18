import { NFTDetail } from '@/components/nft/NFTDetail'

interface PageProps {
  params: { tokenId: string }
}

export function generateMetadata({ params }: PageProps) {
  return {
    title: `Token #${params.tokenId} — Territory NFT`,
    description: `View details, price history, and listing information for Territory NFT #${params.tokenId}.`,
  }
}

export default function NFTDetailPage({ params }: PageProps) {
  return <NFTDetail tokenId={params.tokenId} />
}
