export default function CoachDashboard() {
  return (
    <main
      className="min-h-screen p-8"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <h1
        className="text-4xl font-bold"
        style={{ fontFamily: 'Saira Condensed, sans-serif', color: 'var(--lime)' }}
      >
        Coach Dashboard
      </h1>
      <p className="mt-2" style={{ color: 'var(--muted)' }}>
        Welcome back, Coach.
      </p>
    </main>
  )
}
