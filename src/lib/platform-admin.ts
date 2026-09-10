import 'server-only'

// The single source of truth for "is this the platform owner's own
// account" — gates /admin/platform and every billing action. Previously
// this exact condition was re-derived independently in 3 separate files;
// centralizing it means a future change (e.g. supporting more than one
// admin email) only has to happen once to stay correct everywhere.
export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL
  return Boolean(platformAdminEmail) && email === platformAdminEmail
}
