import type { User } from '../types/auth'

export type WorkspaceType = 'tenant' | 'owner'

const ACTIVE_WORKSPACE_KEY = 'proptech_active_workspace'

/**
 * Returns the list of workspaces the authenticated user is permitted to access.
 * Authorization always derives from backend user capability flags.
 */
export function getAccessibleWorkspaces(user: User | null | undefined): WorkspaceType[] {
  if (!user) return []
  const workspaces: WorkspaceType[] = []
  if (user.is_tenant) {
    workspaces.push('tenant')
  }
  if (user.is_owner) {
    workspaces.push('owner')
  }
  return workspaces
}

export function getStoredWorkspace(): WorkspaceType | null {
  try {
    const raw = localStorage.getItem(ACTIVE_WORKSPACE_KEY)
    if (raw === 'tenant' || raw === 'owner') {
      return raw
    }
    return null
  } catch {
    return null
  }
}

export function setStoredWorkspace(workspace: WorkspaceType): void {
  try {
    localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspace)
  } catch {
    // Ignore storage unavailability (e.g., private browsing restrictions)
  }
}

export function getWorkspaceDashboardRoute(workspace: WorkspaceType): string {
  return workspace === 'owner' ? '/app/owner/dashboard' : '/app/tenant/dashboard'
}

export function getWorkspaceSettingsRoute(workspace: WorkspaceType): string {
  return workspace === 'owner' ? '/app/owner/settings' : '/app/tenant/settings'
}

/**
 * Resolves the target Settings route inside the user's active/preferred workspace.
 */
export function resolveDefaultSettingsRoute(user: User | null | undefined): string | null {
  const accessible = getAccessibleWorkspaces(user)
  if (accessible.length === 0) return null

  const stored = getStoredWorkspace()
  if (stored && accessible.includes(stored)) {
    return getWorkspaceSettingsRoute(stored)
  }

  if (user?.is_owner && !user?.is_tenant) {
    return '/app/owner/settings'
  }

  if (user?.is_owner && stored === null) {
    return '/app/owner/settings'
  }

  if (user?.is_tenant) {
    return '/app/tenant/settings'
  }

  return null
}

/**
 * Resolves the target dashboard route for `/app/dashboard` while honoring:
 * 1) User capability flags (`is_tenant`, `is_owner`)
 * 2) Previously selected workspace preference if still authorized
 * 3) Owner fallback when owner-only, else Tenant Workspace default
 */
export function resolveDefaultWorkspaceRoute(user: User | null | undefined): string {
  const accessible = getAccessibleWorkspaces(user)
  const stored = getStoredWorkspace()

  if (stored && accessible.includes(stored)) {
    return getWorkspaceDashboardRoute(stored)
  }

  if (user?.is_owner && !user?.is_tenant) {
    return '/app/owner/dashboard'
  }

  if (user?.is_owner && stored === null) {
    // Preserve Owner dashboard convenience for existing owners who have no stored preference
    return '/app/owner/dashboard'
  }

  if (user?.is_tenant) {
    return '/app/tenant/dashboard'
  }

  return '/properties'
}

