export default function Home() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: '3rem' }}>
      <h1>Component Marketplace</h1>
      <p>Skeleton foundation — Foundation only. Không có business logic.</p>
      <ul>
        <li>Web: Next.js (port 3000)</li>
        <li>API: Bun + Express (port 4000) — health tại /health</li>
      </ul>
    </main>
  )
}
