import { z } from "zod";
import { normalizeRegistration } from "./registration-format";
export { formatRegistration, normalizeRegistration } from "./registration-format";

export const registrationSchema = z
  .string()
  .transform(normalizeRegistration)
  .pipe(z.string().min(2).max(8).regex(/^[A-Z0-9]+$/, "Enter a valid UK registration"));
