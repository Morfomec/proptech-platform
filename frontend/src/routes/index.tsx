import { createBrowserRouter } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import PublicLayout from '../layouts/PublicLayout'
import DashboardPage from '../pages/app/DashboardPage'
import ProfilePage from '../pages/app/ProfilePage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import ResendVerificationPage from '../pages/auth/ResendVerificationPage'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'
import VerifyEmailPage from '../pages/auth/VerifyEmailPage'
import UIKitPlayground from '../pages/dev/UIKitPlayground'
import LandingPage from '../pages/public/LandingPage'
import NotFoundPage from '../pages/public/NotFoundPage'
import GuestRoute from './GuestRoute'
import ProtectedRoute from './ProtectedRoute'

/**
 * Centralized Application Route Configuration
 *
 * Route Hierarchy:
 * 1. Public Routes: Accessible to all visitors regardless of authentication status.
 * 2. Guest-Only Routes: Wrapped by GuestRoute and AuthLayout (redirects authenticated users to / or their intended destination).
 * 3. Protected Routes: Wrapped by ProtectedRoute under /app (redirects to /login if unauthenticated).
 * 4. Developer & Catch-All Routes: Development sandbox and 404 handler.
 */
export const router = createBrowserRouter([
  // 1. Public Routes
  {
    element: <PublicLayout />,
    children: [
      {
        path: '/',
        element: <LandingPage />,
      },
    ],
  },

  // 2. Guest-Only Routes
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: '/login',
            element: <LoginPage />,
          },
          {
            path: '/register',
            element: <RegisterPage />,
          },
          {
            path: '/verify-email',
            element: <VerifyEmailPage />,
          },
          {
            path: '/resend-verification',
            element: <ResendVerificationPage />,
          },
          {
            path: '/forgot-password',
            element: <ForgotPasswordPage />,
          },
          {
            path: '/reset-password',
            element: <ResetPasswordPage />,
          },
        ],
      },
    ],
  },

  // 3. Protected Application Routes
  {
    path: '/app',
    element: <ProtectedRoute />,
    children: [
      {
        path: 'dashboard',
        element: <DashboardPage />,
      },
      {
        path: 'profile',
        element: <ProfilePage />,
      },
      // Planned nested routes:
      // { path: 'properties', element: <PropertiesPage /> },
      // { path: 'properties/new', element: <NewPropertyPage /> },
      // { path: 'properties/:propertyId', element: <PropertyDetailPage /> },
      // { path: 'profile', element: <ProfilePage /> },
      // { path: 'settings', element: <SettingsPage /> },
    ],
  },

  // 4. Developer Playground
  {
    path: '/dev/ui-kit',
    element: <UIKitPlayground />,
  },

  // 5. Catch-All 404 Route
  {
    element: <PublicLayout />,
    children: [
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
])

export default router
