import { Link } from 'react-router-dom'
import { EmptyState, primaryBtn } from '../components/ui'

export default function NotFoundPage() {
  return (
    <div className="px-4 py-16">
      <EmptyState title="Page not found" action={<Link to="/" className={primaryBtn}>Go to the home page</Link>}>
        The page you’re looking for doesn’t exist.
      </EmptyState>
    </div>
  )
}
