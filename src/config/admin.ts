export const ADMIN_EMAILS = [
  "sobautofix@gmail.com",
  "temitopeagbola@gmail.com",
] as const;

// Retained as the primary administrator identity for existing fixtures and
// operational tooling that need one deterministic account.
export const ADMIN_EMAIL = ADMIN_EMAILS[0];

export function isAllowedAdminEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase();
  return normalizedEmail !== undefined
    && ADMIN_EMAILS.some((allowedEmail) => allowedEmail === normalizedEmail);
}
