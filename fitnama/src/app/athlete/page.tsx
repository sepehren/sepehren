'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'

interface Exercise {
  exercise: { name: string }
  sets: number
  reps: number
  load: number
}

interface Block {
  exercises: Exercise[]
}

interface Section {
  name: string
  blocks: Block[]
}

interface DaySnapshot {
  name: string
  sections: Section[]
}

interface Session {
  id: string
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED'
  daySnapshot: DaySnapshot
  rating?: number
}

interface TodayData {
  session: Session | null
}

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="text-3xl transition-transform hover:scale-110"
          style={{ color: n <= value ? 'var(--lime)' : 'var(--border)', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}
        >
          ★
        </button>
      ))}
    </div>
  )
}

function FinishModal({
  sessionId,
  onClose,
  onFinished,
}: {
  sessionId: string
  onClose: () => void
  onFinished: (rating: number) => void
}) {
  const [rating, setRating] = useState(0)
  const [painFlag, setPainFlag] = useState(false)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (rating === 0) { setError('Please give a rating before finishing.'); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/finish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, painFlag, note }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to finish workout'); return }
      onFinished(rating)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-md p-8 rounded-xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h2
          className="text-2xl font-bold mb-1"
          style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--text)' }}
        >
          Finish Workout
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          How did it go?
        </p>

        <div className="flex flex-col gap-5">
          <div>
            <p className="text-sm font-medium mb-2" style={{ color: 'var(--text)' }}>Session Rating</p>
            <StarRating value={rating} onChange={setRating} />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={painFlag}
              onChange={(e) => setPainFlag(e.target.checked)}
              className="w-4 h-4 rounded"
              style={{ accentColor: 'var(--lime)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>Flag pain or discomfort</span>
          </label>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium" style={{ color: 'var(--text)' }}>Note (optional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Any notes for your coach..."
              className="px-3 py-2 rounded-lg outline-none resize-none"
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                fontFamily: 'Hanken Grotesk, sans-serif',
              }}
            />
          </div>

          {error && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#3d1a1a', color: '#ff6b6b' }}>
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button loading={loading} onClick={handleSubmit} className="flex-1">
              Finish Workout
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkoutPlan({ session }: { session: Session }) {
  const snap = session.daySnapshot
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Chip variant="lime">{snap.name}</Chip>
        <Chip variant={session.status === 'IN_PROGRESS' ? 'danger' : session.status === 'COMPLETED' ? 'muted' : 'default'}>
          {session.status === 'SCHEDULED' ? 'Scheduled' : session.status === 'IN_PROGRESS' ? 'In Progress' : 'Completed'}
        </Chip>
      </div>
      {snap.sections.map((section, si) => (
        <Card key={si}>
          <h3
            className="text-lg font-bold mb-3"
            style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--lime)' }}
          >
            {section.name}
          </h3>
          <div className="flex flex-col gap-2">
            {section.blocks.flatMap((block, bi) =>
              block.exercises.map((ex, ei) => (
                <div
                  key={`${bi}-${ei}`}
                  className="flex items-center justify-between py-2"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <span className="font-medium" style={{ color: 'var(--text)' }}>
                    {ex.exercise.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <Chip variant="muted">{ex.sets} × {ex.reps}</Chip>
                    {ex.load > 0 && (
                      <Chip variant="default">{ex.load} kg</Chip>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function AthletePage() {
  const router = useRouter()
  const [data, setData] = useState<TodayData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [showFinish, setShowFinish] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    fetch('/api/sessions/today', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load session')
        return res.json()
      })
      .then((d: TodayData) => setData(d))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    } finally {
      router.push('/login')
    }
  }

  async function handleStart() {
    if (!data?.session) return
    setStarting(true)
    try {
      const res = await fetch(`/api/sessions/${data.session.id}/start`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to start session')
      setData((prev) => prev?.session ? { session: { ...prev.session, status: 'IN_PROGRESS' } } : prev)
    } catch {
      setError('Could not start workout. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  function handleFinished(rating: number) {
    setShowFinish(false)
    setData((prev) =>
      prev?.session ? { session: { ...prev.session, status: 'COMPLETED', rating } } : prev
    )
  }

  const session = data?.session ?? null

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {showFinish && session && (
        <FinishModal
          sessionId={session.id}
          onClose={() => setShowFinish(false)}
          onFinished={handleFinished}
        />
      )}

      <header
        className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-4">
          <span
            className="text-2xl font-bold"
            style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--lime)' }}
          >
            FitNama
          </span>
          <span className="text-sm font-medium hidden sm:block" style={{ color: 'var(--muted)' }}>
            Today&apos;s Training
          </span>
        </div>
        <Button size="sm" variant="ghost" loading={loggingOut} onClick={handleLogout}>
          Logout
        </Button>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--text)' }}
          >
            Today&apos;s Training
          </h1>
        </div>

        {loading && (
          <Card>
            <div className="animate-pulse flex flex-col gap-4">
              <div className="h-6 w-1/4 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-4 w-full rounded" style={{ background: 'var(--border)' }} />
              <div className="h-4 w-5/6 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-4 w-4/6 rounded" style={{ background: 'var(--border)' }} />
            </div>
          </Card>
        )}

        {error && (
          <Card>
            <p style={{ color: '#f87171' }}>{error}</p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Card>
        )}

        {!loading && !error && !session && (
          <Card>
            <div className="py-12 text-center flex flex-col items-center gap-3">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                style={{ background: 'var(--bg)' }}
              >
                😴
              </div>
              <p
                className="text-lg font-semibold"
                style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--text)' }}
              >
                No workout scheduled for today.
              </p>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                Check back tomorrow or contact your coach.
              </p>
            </div>
          </Card>
        )}

        {!loading && !error && session && session.status === 'COMPLETED' && (
          <div className="flex flex-col gap-4">
            <Card>
              <div className="py-8 text-center flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
                  style={{ background: 'rgba(212,242,70,0.1)' }}
                >
                  🎉
                </div>
                <p
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--lime)' }}
                >
                  Workout Complete!
                </p>
                {session.rating != null && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        className="text-2xl"
                        style={{ color: n <= (session.rating ?? 0) ? 'var(--lime)' : 'var(--border)' }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Card>
            <WorkoutPlan session={session} />
          </div>
        )}

        {!loading && !error && session && (session.status === 'SCHEDULED' || session.status === 'IN_PROGRESS') && (
          <div className="flex flex-col gap-6">
            <WorkoutPlan session={session} />

            <div className="pb-4">
              {session.status === 'SCHEDULED' && (
                <Button size="lg" loading={starting} onClick={handleStart} className="w-full">
                  Start Workout
                </Button>
              )}
              {session.status === 'IN_PROGRESS' && (
                <Button size="lg" onClick={() => setShowFinish(true)} className="w-full">
                  Finish Workout
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
