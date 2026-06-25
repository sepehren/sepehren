export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function GET() {
  try {
    const output = execSync('npx prisma migrate deploy', {
      env: { ...process.env },
      encoding: 'utf8',
    })
    return NextResponse.json({ ok: true, output })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
