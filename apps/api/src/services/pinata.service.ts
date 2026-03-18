import { PinataSDK } from 'pinata'
import config from '../config'
import type { NFTMetadata } from 'territory-nft-shared'

class PinataService {
  private sdk: PinataSDK

  constructor() {
    this.sdk = new PinataSDK({
      pinataJwt: config.pinataJWT,
      pinataGateway: config.pinataGateway,
    })
  }

  /**
   * Upload a raw image buffer to IPFS via Pinata.
   * Returns the IPFS CID of the uploaded file.
  */
  async uploadImage(imageBuffer: Buffer, filename: string): Promise<string> {
    const blob = new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' })
    const file = new File([blob], filename, { type: 'image/png' })
    const result = await this.sdk.upload.public.file(file)
    return result.cid
  }

  /**
   * Upload an NFT metadata JSON object to IPFS via Pinata.
   * Returns the IPFS CID of the metadata file.
  */
  async uploadMetadata(metadata: NFTMetadata): Promise<string> {
    const result = await this.sdk.upload.public.json(metadata)
    return result.cid
  }

  /**
   * Upload image and metadata as separate IPFS files.
   * 1. Upload image → imageCID
   * 2. Inject image URI into metadata
   * 3. Upload metadata → metadataCID
   * Returns both CIDs and their resolved public gateway URLs.
  */
  async uploadNFTAssets(
    imageBuffer: Buffer,
    metadata: Omit<NFTMetadata, 'image'>
  ): Promise<{ imageCID: string; metadataCID: string; imageUrl: string; metadataUrl: string }> {
    // Step 1: upload image
    const imageCID = await this.uploadImage(imageBuffer, metadata.name + '.png')

    // Step 2: construct full metadata with resolved ipfs image URI
    const fullMetadata: NFTMetadata = {
      ...metadata,
      image: `ipfs://${imageCID}`,
    }

    // Step 3: upload metadata JSON
    const metadataCID = await this.uploadMetadata(fullMetadata)

    return {
      imageCID,
      metadataCID,
      imageUrl: this.getGatewayUrl(imageCID),
      metadataUrl: this.getGatewayUrl(metadataCID),
    }
  }

  /**
   * Returns a public Pinata gateway URL for the given CID and optional file path.
   */
  getGatewayUrl(cid: string, path?: string): string {
    const base = `${config.pinataGateway}/ipfs/${cid}`
    return path ? `${base}/${path}` : base
  }
}

export const pinataService = new PinataService()
