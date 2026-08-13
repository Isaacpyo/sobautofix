export const ADMIN_LIST_PAGE_SIZE = 10;

export function positiveAdminPage(value?: string) {
  const parsed = Number.parseInt(value || "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}
