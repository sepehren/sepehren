export default function AthleteDashboard() {
  return (
    <main
      className="min-h-screen p-8"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <h1
        className="text-4xl font-bold"
        style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--lime)' }}
      >
        Athlete Today
      </h1>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>
        Here&apos;s your training for today.
      </p>
    </main>
  )
}
