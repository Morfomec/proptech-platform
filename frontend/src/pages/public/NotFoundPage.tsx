import React from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../../components/ui'

/**
 * NotFoundPage
 * Accessible 404 error page displayed when a route path does not match any known route.
 */
export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6 py-12">
      <div className="max-w-md w-full bg-surface border border-default rounded-2xl p-8 shadow-xs text-center flex flex-col items-center">
        <EmptyState
          size="lg"
          title="Page Not Found"
          description="Sorry, the page you are looking for doesn't exist or has been moved."
          action={
            <Link to="/">
              <Button variant="primary">
                Return to Home
              </Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}

export default NotFoundPage

