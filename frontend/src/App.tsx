import React from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'

/**
 * Root Application Component
 * Renders the centralized React Router configuration within AppProviders.
 */
export const App: React.FC = () => {
  return <RouterProvider router={router} />
}

export default App
