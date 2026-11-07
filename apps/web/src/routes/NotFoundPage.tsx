import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="empty-state animate-fade-up" style={{ paddingTop: 'var(--space-16)' }}>
      <div className="empty-state-icon" style={{ width: 80, height: 80 }}><Compass size={36} /></div>
      <h3>Page not found</h3>
      <p>That page doesn’t exist — it may have moved.</p>
      <Link to="/discover" className="btn btn-primary">Browse the catalog</Link>
    </div>
  )
}
