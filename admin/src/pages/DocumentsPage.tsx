// DocumentsPage is superseded by KnowledgePage (Task 6).
// This file is kept as a redirect for backward compatibility.
import { Navigate } from 'react-router-dom'

export default function DocumentsPage() {
  return <Navigate to="/knowledge" replace />
}
