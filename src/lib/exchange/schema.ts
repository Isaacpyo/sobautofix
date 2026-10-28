// The application ships before or after the exchange migration reaches a
// database. When the tables or columns are missing, features must say so
// clearly instead of failing or exposing a raw database error.

const missingSchemaCodes = new Set([
  "42P01", // undefined_table
  "42703", // undefined_column
  "42883", // undefined_function
  "PGRST200", // relationship not found in schema cache
  "PGRST202", // function not found in schema cache
  "PGRST204", // column not found in schema cache
  "PGRST205", // table not found in schema cache
]);

export function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && missingSchemaCodes.has(code);
}

export class ExchangeSchemaMissingError extends Error {
  constructor() {
    super("Vehicle Buying & Selling needs its database update before this feature can be used.");
    this.name = "ExchangeSchemaMissingError";
  }
}

export const SCHEMA_MISSING_MESSAGE = "Vehicle Buying & Selling needs its database update (migrations 20261028090000-20261028090200). Ask the person with access to the SOB Autofix Supabase project to run the documented migration push.";
