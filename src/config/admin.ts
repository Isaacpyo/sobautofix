export const ADMIN_EMAIL = "sobautofix@gmail.com";

export function isAllowedAdminEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() === ADMIN_EMAIL;
}
