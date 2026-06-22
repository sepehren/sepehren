import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

function getClient(): S3Client {
  const endpoint = process.env.STORAGE_ENDPOINT // R2: https://<account>.r2.cloudflarestorage.com
  const region = process.env.STORAGE_REGION ?? 'auto'
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('STORAGE_ACCESS_KEY_ID and STORAGE_SECRET_ACCESS_KEY must be set')
  }

  return new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle: false } : {}),
    credentials: { accessKeyId, secretAccessKey },
  })
}

const BUCKET = process.env.STORAGE_BUCKET ?? 'fitnama'
// Signed URL valid for 5 minutes — enough time for a direct browser upload
const PRESIGN_EXPIRES = 300

export type AllowedImageType = 'image/jpeg' | 'image/png' | 'image/webp'

export async function createUploadUrl(
  athleteId: string,
  contentType: AllowedImageType
): Promise<{ uploadUrl: string; objectKey: string; publicUrl: string }> {
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg'
  const objectKey = `progress/${athleteId}/${randomUUID()}.${ext}`

  const client = getClient()
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: objectKey,
    ContentType: contentType,
    // Prevent storing bytes in DB — only the URL is persisted
    Metadata: { athleteId },
  })

  const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES })
  const publicBase = process.env.STORAGE_PUBLIC_BASE_URL ?? `https://${BUCKET}.s3.amazonaws.com`
  const publicUrl = `${publicBase}/${objectKey}`

  return { uploadUrl, objectKey, publicUrl }
}
