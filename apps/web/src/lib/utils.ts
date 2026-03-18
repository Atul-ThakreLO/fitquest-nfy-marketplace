import { formatDistanceToNow } from 'date-fns'
import { formatEther } from 'viem'

export function resolveIPFS(cid: string, path = ''): string {
  const gateway = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? 'https://gateway.pinata.cloud'
  if (cid.startsWith("ipfs://")) {
    return cid.replace("ipfs://", `${gateway}/ipfs/`);
  }
  return `${gateway}/ipfs/${cid}${path}`
}

export async function resolveImageIPFS(metaDataURL: string) {
  const metaData = await fetch(metaDataURL)
  const data = await metaData.json()
  return resolveIPFS(data.image)
}

export function formatEth(wei: bigint, decimals = 4): string {
  const eth = Number(formatEther(wei))
  // return `${eth.toFixed(decimals)} ETH`
  return eth.toString();
}

export function truncateAddress(address: string, chars = 4): string {
  if (!address || address.length < chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function formatTimestamp(unix: number): string {
  const date = new Date(unix * 1000)
  return formatDistanceToNow(date, { addSuffix: true })
}

export function formatUnixDate(unix: number): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(unix * 1000))
}

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ')
}
