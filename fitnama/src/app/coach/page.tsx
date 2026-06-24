'use client'

import { useState, useEffect, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'
import { Field } from '@/components/ui/Field'

interface AthleteQueueItem {
  athleteId: string
  name: string
  score: number
  action: string
  reasons: string[]
  lastSession: string | null
  unreadMessages: number
}

interface DashboardData {
  queue: AthleteQueueItem[]
}

function actionChipVariant(action: string): 'danger' | 'lime' | 'muted' | 'default' {
  if (action.toLowerCase().includes('pain')) return 'danger'
  if (action.toLowerCase().includes('adjust')) return 'lime'
  return 'default'
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function SkeletonCard() {
  return (
    <Card>
      <div className="animate-pulse flex flex-col gap-3">
        <div className="h-5 w-1/3 rounded" style={{ background: 'var(--border)' }} />
        <div className="h-4 w-1/2 rounded" style={{ background: 'var(--border)' }} />
        <div className="h-4 w-2/3 rounded" style={{ background: 'var(--border)' }} />
      </div>
    </Card>
  )
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/athletes/invite', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to send invite')
        return
      }
      setSuccess(true)
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
          Invite Athlete
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
          They&apos;ll receive an email to join FitNama.
        </p>

        {success ? (
          <div className="flex flex-col gap-4">
            <p
              className="text-sm px-4 py-3 rounded-lg"
              style={{
                background: 'rgba(212,242,70,0.1)',
                color: 'var(--lime)',
                border: '1px solid rgba(212,242,70,0.3)',
              }}
            >
              Invite sent to <strong>{email}</strong>!
            </p>
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field
              label="Name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Athlete's name"
            />
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="athlete@example.com"
            />
            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#3d1a1a', color: '#ff6b6b' }}>
                {error}
              </p>
            )}
            <div className="flex gap-3 mt-2">
              <Button type="submit" loading={loading} className="flex-1">Send Invite</Button>
              <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

export default function CoachDashboard() {
  const router = useRouter()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    fetch('/api/coach/dashboard', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load dashboard')
        return res.json()
      })
      .then((d: DashboardData) => setData(d))
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

  const sorted = data ? [...data.queue].sort((a, b) => b.score - a.score) : []

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} />}

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
            Coach Dashboard
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setShowInvite(true)}>
            + Invite Athlete
          </Button>
          <Button size="sm" variant="ghost" loading={loggingOut} onClick={handleLogout}>
            Logout
          </Button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1
            className="text-3xl font-bold"
            style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--text)' }}
          >
            Athlete Queue
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
            Athletes sorted by priority score — highest needs first.
          </p>
        </div>

        {loading && (
          <div className="flex flex-col gap-4">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {error && (
          <Card>
            <p style={{ color: '#f87171' }}>{error}</p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Card>
        )}

        {!loading && !error && sorted.length === 0 && (
          <Card>
            <div className="py-12 text-center flex flex-col items-center gap-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center text-2xl"
                style={{ background: 'var(--bg)' }}
              >
                🏋️
              </div>
              <p
                className="text-lg font-semibold"
                style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--text)' }}
              >
                No athletes yet. Invite your first athlete.
              </p>
              <Button onClick={() => setShowInvite(true)}>+ Invite Athlete</Button>
            </div>
          </Card>
        )}

        {!loading && !error && sorted.length > 0 && (
          <div className="flex flex-col gap-4">
            {sorted.map((athlete) => (
              <a
                key={athlete.athleteId}
                href={`/coach/athletes/${athlete.athleteId}`}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <Card style={{ cursor: 'pointer' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span
                          className="text-xl font-bold"
                          style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--text)' }}
                        >
                          {athlete.name}
                        </span>
                        {athlete.unreadMessages > 0 && (
                          <span
                            className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
                            style={{ background: 'var(--lime)', color: '#0d0d0b' }}
                            title={`${athlete.unreadMessages} unread messages`}
                          >
                            {athlete.unreadMessages}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Chip variant={actionChipVariant(athlete.action)}>
                          {athlete.action}
                        </Chip>
                        {athlete.reasons.map((r, i) => (
                          <Chip key={i} variant="muted">{r}</Chip>
                        ))}
                      </div>

                      <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                        Last session: {formatDate(athlete.lastSession)}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className="text-3xl font-black"
                        style={{
                          fontFamily: 'Saira Condensed, sans-serif',
                          color:
                            athlete.score >= 150
                              ? '#f87171'
                              : athlete.score >= 100
                              ? '#fb923c'
                              : 'var(--lime)',
                        }}
                      >
                        {athlete.score}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>score</span>
                    </div>
                  </div>
                </Card>
              </a>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
