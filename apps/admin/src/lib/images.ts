import { supabase } from './supabase'

export const IMAGE_BUCKET = 'product-images'
export const MAX_PHOTOS = 5
const MAX_SIDE = 1200
const MAX_SOURCE_BYTES = 20 * 1024 * 1024

export const imageUrl = (path: string) => supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

/**
 * Shrinks a photo in the browser before upload: longest side 1200px, saved as WebP
 * (JPEG if the browser can't). Phone photos drop from several MB to a few hundred KB,
 * which keeps the website fast on slow connections.
 */
export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('That file is not a picture.')
  if (file.size > MAX_SOURCE_BYTES) throw new Error('That picture is too large (over 20 MB).')

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const webp = await toBlob(canvas, 'image/webp', 0.82)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob(canvas, 'image/jpeg', 0.85)
  if (!jpeg) throw new Error('We couldn’t prepare that picture.')
  return jpeg
}

export const extensionFor = (blob: Blob) => (blob.type === 'image/webp' ? 'webp' : 'jpg')
