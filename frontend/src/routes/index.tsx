import { createBrowserRouter, Navigate } from 'react-router-dom'
import AuthLayout from '../layouts/AuthLayout'
import PublicLayout from '../layouts/PublicLayout'
import OwnerWorkspaceLayout from '../layouts/OwnerWorkspaceLayout'
import TenantWorkspaceLayout from '../layouts/TenantWorkspaceLayout'
import DashboardPage from '../pages/app/DashboardPage'
import AccountSettingsPage from '../pages/app/AccountSettingsPage'
import ProfilePage from '../pages/app/ProfilePage'
import TenantDashboardPage from '../pages/tenant/TenantDashboardPage'
import TenantApplyPropertyPage from '../pages/tenant/TenantApplyPropertyPage'
import TenantApplicationsPage from '../pages/tenant/TenantApplicationsPage'
import TenantApplicationDetailPage from '../pages/tenant/TenantApplicationDetailPage'
import TenantTenancyPage from '../pages/tenant/TenantTenancyPage'
import TenantDocumentsPage from '../pages/tenant/TenantDocumentsPage'
import TenantNotificationsPage from '../pages/tenant/TenantNotificationsPage'
import OwnerDashboardPage from '../pages/owner/OwnerDashboardPage'
import OwnerApplicationsPage from '../pages/owner/OwnerApplicationsPage'
import OwnerApplicationDetailPage from '../pages/owner/OwnerApplicationDetailPage'
import OwnerTenanciesPage from '../pages/owner/OwnerTenanciesPage'
import OwnerTenancyDetailPage from '../pages/owner/OwnerTenancyDetailPage'
import OwnerDocumentsPage from '../pages/owner/OwnerDocumentsPage'
import OwnerNotificationsPage from '../pages/owner/OwnerNotificationsPage'
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
import TenantRoute from './TenantRoute'

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
              {
                path: 'applications',
                element: <OwnerApplicationsPage />,
              },
              {
                path: 'applications/:applicationId',
                element: <OwnerApplicationDetailPage />,
              },
              {
                path: 'tenancies',
                element: <OwnerTenanciesPage />,
              },
              {
                path: 'tenancies/:tenancyId',
                element: <OwnerTenancyDetailPage />,
              },
              {
                path: 'documents',
                element: <OwnerDocumentsPage />,
              },
              {
                path: 'notifications',
                element: <OwnerNotificationsPage />,
              },
              {
                path: 'settings',
                element: <AccountSettingsPage />,
              },
            ],
          },
        ],
      },
      // Dedicated Tenant Workspace Routes
      {
        path: 'tenant',
        element: <TenantRoute />,
        children: [
          {
            element: <TenantWorkspaceLayout />,
            children: [
              {
                index: true,
                element: <Navigate to="/app/tenant/dashboard" replace />,
              },
              {
                path: 'dashboard',
                element: <TenantDashboardPage />,
              },
              {
                path: 'properties',
                element: <BrowseRentalsPage workspaceMode="tenant" />,
              },
              {
                path: 'properties/:id',
                element: <PublicPropertyDetailPage workspaceMode="tenant" />,
              },
              {
                path: 'properties/:id/apply',
                element: <TenantApplyPropertyPage />,
              },
              {
                path: 'saved-properties',
                element: <SavedPropertiesPage workspaceMode="tenant" />,
              },
              {
                path: 'applications',
                element: <TenantApplicationsPage />,
              },
              {
                path: 'applications/:applicationId',
                element: <TenantApplicationDetailPage />,
              },
              {
                path: 'tenancy',
                element: <TenantTenancyPage />,
              },
              {
                path: 'documents',
                element: <TenantDocumentsPage />,
              },
              {
                path: 'notifications',
                element: <TenantNotificationsPage />,
              },
              {
                path: 'settings',
                element: <AccountSettingsPage />,
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

if (import.meta.hot) {
  // React Router's RouterProvider keeps its initial router instance across HMR updates.
  import.meta.hot.accept(() => import.meta.hot?.invalidate())
}
