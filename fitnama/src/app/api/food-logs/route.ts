import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'

const createSchema = z.object({
  food: z.string().min(1, 'Food name is required'),
  kcal: z.number().int().min(0),
  protein: z.number().int().min(0).default(0),
  carbs: z.number().int().min(0).default(0),
  fat: z.number().int().min(0).default(0),
  loggedFor: z.string().datetime().optional(),
})

// GET /api/food-logs?date=YYYY-MM-DD — athlete's logs for a day + macro totals
export async function GET(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { searchParams } = request.nextUrl
    const dateParam = searchParams.get('date')

    let start: Date
    let end: Date

    if (dateParam) {
      start = new Date(`${dateParam}T00:00:00.000Z`)
      end = new Date(`${dateParam}T23:59:59.999Z`)
    } else {
      const now = new Date()
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
    }

    const logs = await prisma.foodLog.findMany({
      where: {
        athleteId: session.userId,
        loggedFor: { gte: start, lte: end },
      },
      orderBy: { createdAt: 'asc' },
    })

    const totals = logs.reduce(
      (acc, l) => ({
        kcal: acc.kcal + l.kcal,
        protein: acc.protein + l.protein,
        carbs: acc.carbs + l.carbs,
        fat: acc.fat + l.fat,
      }),
      { kcal: 0, protein: 0, carbs: 0, fat: 0 }
    )

    return NextResponse.json({ logs, totals })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/food-logs — athlete logs a food item
export async function POST(request: NextRequest) {
  try {
    const session = await getSession(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (session.role !== 'ATHLETE') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }

    const { loggedFor, ...rest } = parsed.data
    const log = await prisma.foodLog.create({
      data: {
        athleteId: session.userId,
        loggedFor: loggedFor ? new Date(loggedFor) : new Date(),
        ...rest,
      },
    })

    return NextResponse.json({ log }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
