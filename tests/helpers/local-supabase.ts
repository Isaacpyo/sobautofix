import { createHmac, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type LocalSupabaseConfig = {
  url: string;
  publishableKey: string;
  secretKey: string;
};

type LocalTestIdentity = {
  id: string;
  email: string;
  accessToken: string;
};

export type LocalTestUsers = {
  service: SupabaseClient;
  anon: SupabaseClient;
  admin: SupabaseClient;
  secondaryAdmin: SupabaseClient;
  nonAdmin: SupabaseClient;
  adminIdentity: LocalTestIdentity;
  secondaryAdminIdentity: LocalTestIdentity;
  nonAdminIdentity: LocalTestIdentity;
};

export const localAdminEmail = "sobautofix@gmail.com";
export const localSecondaryAdminEmail = "temitopeagbola@gmail.com";
export const localTestPassword = "Local-only-9f2e7c4a!";
const localDatabaseContainer = "supabase_db_sobautofix-local-tests";

export function getLocalSupabaseConfig(): LocalSupabaseConfig {
  const url = firstEnvironmentValue("INTEGRATION_SUPABASE_URL", "API_URL", "SUPABASE_URL");
  const publishableKey = firstEnvironmentValue(
    "INTEGRATION_SUPABASE_PUBLISHABLE_KEY",
    "PUBLISHABLE_KEY",
    "ANON_KEY",
  );
  const secretKey = firstEnvironmentValue(
    "INTEGRATION_SUPABASE_SECRET_KEY",
    "SECRET_KEY",
    "SERVICE_ROLE_KEY",
  );

  const parsed = new URL(url);
  const isLoopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1" || parsed.hostname === "[::1]";
  if (!isLoopback || parsed.protocol !== "http:" || parsed.port !== "54321") {
    throw new Error(`Refusing to run database integration tests against non-local Supabase URL: ${parsed.origin}`);
  }

  return { url: parsed.origin, publishableKey, secretKey };
}

export function createLocalClient(key: string, accessToken?: string) {
  const { url } = getLocalSupabaseConfig();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

export async function provisionLocalTestUsers(): Promise<LocalTestUsers> {
  const config = getLocalSupabaseConfig();
  const service = createLocalClient(config.secretKey);
  const anon = createLocalClient(config.publishableKey);
  const runId = randomUUID().slice(0, 12);
  const nonAdminEmail = `invoice-non-admin-${runId}@example.test`;

  const adminIdentity = await ensureLocalAdminIdentity(service, config.publishableKey, localAdminEmail);
  const secondaryAdminIdentity = await ensureLocalAdminIdentity(service, config.publishableKey, localSecondaryAdminEmail);
  const nonAdminIdentity = await createLocalIdentity(service, config.publishableKey, nonAdminEmail);

  executeLocalOwnerSql(
    `
      insert into public.admin_profiles (user_id, display_name)
      values
        (:'admin_id'::uuid, 'Local Invoice Test Admin'),
        (:'secondary_admin_id'::uuid, 'Secondary Local Invoice Test Admin')
      on conflict (user_id) do update set display_name = excluded.display_name;
    `,
    { admin_id: adminIdentity.id, secondary_admin_id: secondaryAdminIdentity.id },
  );

  return {
    service,
    anon,
    admin: createLocalClient(config.publishableKey, adminIdentity.accessToken),
    secondaryAdmin: createLocalClient(config.publishableKey, secondaryAdminIdentity.accessToken),
    nonAdmin: createLocalClient(config.publishableKey, nonAdminIdentity.accessToken),
    adminIdentity,
    secondaryAdminIdentity,
    nonAdminIdentity,
  };
}

export function executeLocalOwnerSql(sql: string, variables: Record<string, string> = {}) {
  getLocalSupabaseConfig();
  const variableArguments = Object.entries(variables).flatMap(([name, value]) => {
    if (!/^[a-z][a-z0-9_]*$/i.test(name)) throw new Error(`Invalid local SQL variable name: ${name}`);
    return ["--set", `${name}=${value}`];
  });

  try {
    execFileSync(
      "docker",
      [
        "exec",
        "-i",
        "--env",
        "PGPASSWORD=postgres",
        localDatabaseContainer,
        "psql",
        "--host",
        "127.0.0.1",
        "--username",
        "postgres",
        "--dbname",
        "postgres",
        "--no-psqlrc",
        "--quiet",
        "--set",
        "ON_ERROR_STOP=1",
        ...variableArguments,
      ],
      { input: sql, encoding: "utf8", timeout: 15_000, windowsHide: true },
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not seed the isolated local Supabase database as owner: ${detail}`);
  }
}

export function invoiceDraftPayload(issueDate: string, suffix = randomUUID().slice(0, 8)) {
  return {
    source_type: "manual",
    booking_id: "",
    enquiry_id: "",
    customer_id: "",
    vehicle_id: "",
    customer_name: `Local Test Customer ${suffix}`,
    customer_email: `invoice-${suffix}@example.test`,
    customer_phone: "07000000000",
    customer_address: "1 Local Test Street, Doncaster, DN1 1AA",
    vehicle_registration: `T${suffix.slice(0, 6)}`,
    vehicle_make: "Test",
    vehicle_model: "Fixture",
    service_name: "Concurrency test",
    appointment_start: "",
    issue_date: issueDate,
    due_date: "",
    discount_pence: "0",
    tax_pence: "0",
    notes: "Local integration data only.",
    payment_terms: "Payment due within 7 days.",
    items: [{ description: "Exact fractional work", quantity: "1.250", unit_price_pence: "799" }],
  };
}

async function createLocalIdentity(service: SupabaseClient, publishableKey: string, email: string): Promise<LocalTestIdentity> {
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    password: localTestPassword,
    email_confirm: true,
  });
  if (createError || !created.user) throw new Error(`Could not create local Auth user ${email}: ${createError?.message}`);

  const authClient = createLocalClient(publishableKey);
  const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password: localTestPassword });
  if (signInError || !signedIn.session) throw new Error(`Could not sign in local Auth user ${email}: ${signInError?.message}`);

  return { id: created.user.id, email, accessToken: signedIn.session.access_token };
}

async function ensureLocalIdentity(service: SupabaseClient, publishableKey: string, email: string): Promise<LocalTestIdentity> {
  const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error(`Could not inspect local Auth users: ${error.message}`);
  const existing = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existing) return createLocalIdentity(service, publishableKey, email);

  const { error: updateError } = await service.auth.admin.updateUserById(existing.id, {
    password: localTestPassword,
    email_confirm: true,
  });
  if (updateError) throw new Error(`Could not reset local Auth user: ${updateError.message}`);

  const authClient = createLocalClient(publishableKey);
  const { data: signedIn, error: signInError } = await authClient.auth.signInWithPassword({ email, password: localTestPassword });
  if (signInError || !signedIn.session) throw new Error(`Could not sign in local Auth user ${email}: ${signInError?.message}`);
  return { id: existing.id, email, accessToken: signedIn.session.access_token };
}

async function ensureLocalAdminIdentity(service: SupabaseClient, publishableKey: string, email: string): Promise<LocalTestIdentity> {
  const identity = await ensureLocalIdentity(service, publishableKey, email);
  const { data: factors, error: factorsError } = await service.auth.admin.mfa.listFactors({ userId: identity.id });
  if (factorsError) throw new Error(`Could not inspect local MFA factors for ${email}: ${factorsError.message}`);
  for (const factor of factors.factors) {
    const { error } = await service.auth.admin.mfa.deleteFactor({ userId: identity.id, id: factor.id });
    if (error) throw new Error(`Could not reset local MFA factor for ${email}: ${error.message}`);
  }

  const authClient = createLocalClient(publishableKey);
  const { error: signInError } = await authClient.auth.signInWithPassword({ email, password: localTestPassword });
  if (signInError) throw new Error(`Could not start local MFA session for ${email}: ${signInError.message}`);
  const { data: enrollment, error: enrollmentError } = await authClient.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Local integration tests",
  });
  if (enrollmentError || !enrollment || enrollment.type !== "totp") {
    throw new Error(`Could not enroll local MFA for ${email}: ${enrollmentError?.message || "TOTP unavailable"}`);
  }
  const { data: verified, error: verificationError } = await authClient.auth.mfa.challengeAndVerify({
    factorId: enrollment.id,
    code: currentTotp(enrollment.totp.secret),
  });
  if (verificationError || !verified.access_token) {
    throw new Error(`Could not verify local MFA for ${email}: ${verificationError?.message || "AAL2 token unavailable"}`);
  }
  return { id: identity.id, email, accessToken: verified.access_token };
}

function currentTotp(secret: string) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const lastByte = digest[digest.length - 1];
  if (lastByte === undefined) throw new Error("Local TOTP digest is empty");
  const offset = lastByte & 0x0f;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function decodeBase32(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const character of value.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error("Local TOTP secret contains an invalid base32 character");
    bits += index.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function firstEnvironmentValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing local Supabase test environment variable (${names.join(" or ")}).`);
}
