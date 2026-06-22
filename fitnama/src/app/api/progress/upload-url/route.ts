import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createUploadUrl, type AllowedImageType } from '@/lib/storage'

const schema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { uploadUrl, objectKey, publicUrl } = await createUploadUrl(
      session.userId,
      parsed.data.contentType as AllowedImageType
    )

    return NextResponse.json({ uploadUrl, objectKey, publicUrl })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
