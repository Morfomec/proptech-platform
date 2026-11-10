import { createBrowserRouter, Navigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import PublicLayout from '../layouts/PublicLayout'
import OwnerWorkspaceLayout from '../layouts/OwnerWorkspaceLayout'
import DashboardPage from '../pages/app/DashboardPage'
import ProfilePage from '../pages/app/ProfilePage'
import OwnerDashboardPage from '../pages/owner/OwnerDashboardPage'
import MyPropertiesPage from '../pages/owner/MyPropertiesPage'
import AddPropertyWizardPage from '../pages/owner/AddPropertyWizardPage'
import PropertyDetailPage from '../pages/owner/PropertyDetailPage'
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage'
import LoginPage from '../pages/auth/LoginPage'
import RegisterPage from '../pages/auth/RegisterPage'
import ResendVerificationPage from '../pages/auth/ResendVerificationPage'
import ResetPasswordPage from '../pages/auth/ResetPasswordPage'
import VerifyEmailPage from '../pages/auth/VerifyEmailPage'
import UIKitPlayground from '../pages/dev/UIKitPlayground'
import LandingPage from '../pages/public/LandingPage'
import BrowseRentalsPage from '../pages/public/BrowseRentalsPage'
import PublicPropertyDetailPage from '../pages/public/PublicPropertyDetailPage'
import SavedPropertiesPage from '../pages/public/SavedPropertiesPage'
import NotFoundPage from '../pages/public/NotFoundPage'
import GuestRoute from './GuestRoute'
import ProtectedRoute from './ProtectedRoute'
import OwnerRoute from './OwnerRoute'

/**
 * Centralized Application Route Configuration
 *
 * Route Hierarchy:
 * 1. Public Routes: Accessible to all visitors regardless of authentication status.
 * 2. Guest-Only Routes: Wrapped by GuestRoute and AuthLayout.
 * 3. Protected Routes: Wrapped by ProtectedRoute under /app.
 * 4. Owner Workspace: Nested under /app/owner guarded by OwnerRoute (strictly user.is_owner === true).
 * 5. Developer & Catch-All Routes: Development sandbox and 404 handler.
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
      {
        path: '/properties',
        element: <BrowseRentalsPage />,
      },
      {
        path: '/properties/:id',
        element: <PublicPropertyDetailPage />,
      },
      {
        path: '/rentals',
        element: <Navigate to="/properties" replace />,
      },
      {
        path: '/rentals/:id',
        element: <PublicPropertyDetailPage />,
      },
      {
        path: '/saved-properties',
        element: <SavedPropertiesPage />,
      },
      {
        path: '/saved',
        element: <Navigate to="/saved-properties" replace />,
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
      // Dedicated Owner Workspace Routes
      {
        path: 'owner',
        element: <OwnerRoute />,
        children: [
          {
            element: <OwnerWorkspaceLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/app/owner/dashboard" replace />,
              },
              {
                path: 'dashboard',
                element: <OwnerDashboardPage />,
              },
              {
                path: 'properties',
                element: <MyPropertiesPage />,
              },
              {
                path: 'properties/new',
                element: <AddPropertyWizardPage />,
              },
              {
                path: 'properties/:propertyId',
                element: <PropertyDetailPage />,
              },
              {
                path: 'properties/:propertyId/edit',
                element: <AddPropertyWizardPage />,
              },
            ],
          },
        ],
      },
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
