'use client'

import { useState, useEffect, useRef, FormEvent } from 'react'
import { useParams } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Chip } from '@/components/ui/Chip'

interface CheckIn {
  id: string
  createdAt: string
  reviewedAt: string | null
  energy: number
  soreness: number
  stress: number
  sleep: number
  athleteId: string
}

interface CheckInsResponse {
  checkIns: CheckIn[]
}

interface Message {
  id: string
  content: string
  createdAt: string
  sender: { id: string; name: string; role: string }
}

function ScoreBadge({ label, value }: { label: string; value: number }) {
  const color = value >= 7 ? 'var(--lime)' : value >= 4 ? '#fb923c' : '#f87171'
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-xl font-black"
        style={{ fontFamily: 'Saira Condensed, sans-serif', color }}
      >
        {value}
      </span>
      <span className="text-xs" style={{ color: 'var(--muted)' }}>{label}</span>
    </div>
  )
}

function CheckInsTab({ athleteId }: { athleteId: string }) {
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/checkins', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load check-ins')
        return res.json()
      })
      .then((d: CheckInsResponse) => {
        const filtered = d.checkIns.filter((c) => c.athleteId === athleteId)
        setCheckIns(filtered)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [athleteId])

  async function handleReview(id: string) {
    setReviewing(id)
    try {
      const res = await fetch(`/api/checkins/${id}/review`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to mark reviewed')
      setCheckIns((prev) =>
        prev.map((c) => c.id === id ? { ...c, reviewedAt: new Date().toISOString() } : c)
      )
    } catch {
      // silently fail — user can retry
    } finally {
      setReviewing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-3 mt-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <div className="animate-pulse flex flex-col gap-2">
              <div className="h-4 w-1/3 rounded" style={{ background: 'var(--border)' }} />
              <div className="h-4 w-2/3 rounded" style={{ background: 'var(--border)' }} />
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="mt-4">
        <p style={{ color: '#f87171' }}>{error}</p>
      </Card>
    )
  }

  if (checkIns.length === 0) {
    return (
      <Card className="mt-4">
        <p className="text-center py-8" style={{ color: 'var(--muted)' }}>
          No check-ins yet.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3 mt-4">
      {checkIns.map((c) => (
        <Card key={c.id}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {c.reviewedAt ? (
                  <Chip variant="muted">Reviewed</Chip>
                ) : (
                  <Chip variant="danger">Pending</Chip>
                )}
              </div>
              <div className="flex gap-5">
                <ScoreBadge label="Energy" value={c.energy} />
                <ScoreBadge label="Soreness" value={c.soreness} />
                <ScoreBadge label="Stress" value={c.stress} />
                <ScoreBadge label="Sleep" value={c.sleep} />
              </div>
            </div>
            {!c.reviewedAt && (
              <Button
                size="sm"
                variant="ghost"
                loading={reviewing === c.id}
                onClick={() => handleReview(c.id)}
              >
                Mark Reviewed
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}

function MessagesTab({ athleteId }: { athleteId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [conversationId, setConversationId] = useState<string | null>(null)

  // Try to resolve conversation by fetching messages with a known conversation approach.
  // Since the dashboard doesn't return a conversation ID, we attempt a lookup via a
  // convention endpoint — if it fails we show the placeholder note.
  useEffect(() => {
    setLoading(true)
    fetch(`/api/conversations?athleteId=${athleteId}`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return null
        return res.json()
      })
      .then((d: { id?: string; conversationId?: string } | null) => {
        const id = d?.id ?? d?.conversationId ?? null
        if (id) {
          setConversationId(id)
          return fetch(`/api/conversations/${id}/messages`, { credentials: 'include' })
        }
        return null
      })
      .then(async (res) => {
        if (!res) return
        const d = await res.json()
        setMessages(d.messages ?? d ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [athleteId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!newMsg.trim() || !conversationId) return
    setSending(true)
    const optimistic: Message = {
      id: `tmp-${Date.now()}`,
      content: newMsg,
      createdAt: new Date().toISOString(),
      sender: { id: 'coach', name: 'You', role: 'COACH' },
    }
    setMessages((prev) => [...prev, optimistic])
    setNewMsg('')
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: optimistic.content }),
      })
    } catch {
      // message shown optimistically; silent fail
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <Card className="mt-4">
        <div className="animate-pulse flex flex-col gap-2 py-4">
          <div className="h-4 w-2/3 rounded" style={{ background: 'var(--border)' }} />
          <div className="h-4 w-1/2 rounded" style={{ background: 'var(--border)' }} />
        </div>
      </Card>
    )
  }

  if (!conversationId) {
    return (
      <Card className="mt-4">
        <div className="py-8 text-center flex flex-col items-center gap-2">
          <span className="text-2xl">💬</span>
          <p className="font-medium" style={{ color: 'var(--text)' }}>Open Messages</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            The conversation thread will appear here once it&apos;s available.
            Check back after the athlete has exchanged their first message.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div
        className="rounded-xl p-4 flex flex-col gap-3 overflow-y-auto"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          minHeight: '300px',
          maxHeight: '480px',
        }}
      >
        {messages.length === 0 && (
          <p className="text-sm text-center my-auto" style={{ color: 'var(--muted)' }}>
            No messages yet. Start the conversation!
          </p>
        )}
        {messages.map((msg) => {
          const isCoach = msg.sender.role === 'COACH'
          return (
            <div key={msg.id} className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-xs px-4 py-2 rounded-2xl text-sm"
                style={{
                  background: isCoach ? 'var(--lime)' : 'var(--bg)',
                  color: isCoach ? '#0d0d0b' : 'var(--text)',
                  border: isCoach ? 'none' : '1px solid var(--border)',
                }}
              >
                {!isCoach && (
                  <span className="block text-xs font-semibold mb-1" style={{ color: 'var(--muted)' }}>
                    {msg.sender.name}
                  </span>
                )}
                {msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <input
          type="text"
          value={newMsg}
          onChange={(e) => setNewMsg(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-4 py-2 rounded-lg outline-none"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
          }}
        />
        <Button type="submit" loading={sending} disabled={!newMsg.trim()}>
          Send
        </Button>
      </form>
    </div>
  )
}

type Tab = 'checkins' | 'messages'

export default function AthleteDetailPage() {
  const params = useParams<{ athleteId: string }>()
  const athleteId = params.athleteId
  const [activeTab, setActiveTab] = useState<Tab>('checkins')
  const [athleteName, setAthleteName] = useState<string>('Athlete')

  // Try to pick up the athlete name from the dashboard cache (best effort)
  useEffect(() => {
    fetch('/api/coach/dashboard', { credentials: 'include' })
      .then((res) => res.ok ? res.json() : null)
      .then((d: { queue: Array<{ athleteId: string; name: string }> } | null) => {
        if (!d) return
        const found = d.queue.find((a) => a.athleteId === athleteId)
        if (found) setAthleteName(found.name)
      })
      .catch(() => {})
  }, [athleteId])

  return (
    <main className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <header
        className="sticky top-0 z-40 flex items-center gap-4 px-6 py-4"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <span
          className="text-2xl font-bold"
          style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--lime)' }}
        >
          FitNama
        </span>
        <a
          href="/coach"
          className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: 'var(--muted)', textDecoration: 'none' }}
        >
          ← Back
        </a>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <h1
          className="text-4xl font-bold mb-6"
          style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--text)' }}
        >
          {athleteName}
        </h1>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', display: 'inline-flex' }}
        >
          {(['checkins', 'messages'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-5 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: activeTab === tab ? 'var(--lime)' : 'transparent',
                color: activeTab === tab ? '#0d0d0b' : 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {tab === 'checkins' ? 'Check-ins' : 'Messages'}
            </button>
          ))}
        </div>

        {activeTab === 'checkins' && <CheckInsTab athleteId={athleteId} />}
        {activeTab === 'messages' && <MessagesTab athleteId={athleteId} />}
      </div>
    </main>
  )
}
