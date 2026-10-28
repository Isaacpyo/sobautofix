// Local demo data for SOB Auto Exchange development and screenshots.
// Refuses to run against anything except the local Supabase stack.
//
//   node scripts/exchange-local-seed.mjs
//
// Creates two local staff logins (password below), sample stock using the
// SOB workshop photography as clearly-labelled demo photos, a seller
// submission, a viewing request and a reservation. Re-running replaces the
// demo rows. Never point this at a hosted project.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8").split("\n").filter((line) => line && !line.startsWith("#") && line.includes("=")).map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
);
const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "54321") throw new Error(`Refusing to seed a non-local database: ${url.origin}`);

const db = createClient(url.origin, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
export const LOCAL_PASSWORD = "Local-only-9f2e7c4a!";

async function must(promise, label) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function ensureStaff(email, displayName, role) {
  const { data: list } = await db.auth.admin.listUsers({ perPage: 200 });
  let user = list.users.find((candidate) => candidate.email === email);
  if (!user) user = (await must(db.auth.admin.createUser({ email, password: LOCAL_PASSWORD, email_confirm: true }), `create ${email}`)).user;
  await must(db.from("admin_profiles").upsert({ user_id: user.id, display_name: displayName, staff_role: role }), "admin profile");
  return user.id;
}

const ownerId = await ensureStaff("sobautofix@gmail.com", "SOB Autofix Admin", "owner");
await ensureStaff("temitopeagbola@gmail.com", "Temitope (sales demo)", "sales");
// Local only: let demo staff sign in without enrolling an authenticator.
await must(db.from("admin_mfa_policy").update({ mandatory_mfa_enabled: false }).eq("singleton", true), "mfa policy");

// Remove previous demo rows (identified by the demo- slug prefix).
const { data: oldVehicles } = await db.from("sale_vehicles").select("id").like("slug", "demo-%");
const oldIds = (oldVehicles || []).map((row) => row.id);
if (oldIds.length) {
  await db.from("diary_appointments").delete().in("sale_vehicle_id", oldIds);
  await db.from("vehicle_sales").delete().in("sale_vehicle_id", oldIds);
  await db.from("enquiries").update({ sale_vehicle_id: null }).in("sale_vehicle_id", oldIds);
  await db.from("seller_submissions").update({ interested_vehicle_id: null }).in("interested_vehicle_id", oldIds);
  await db.from("sale_vehicles").delete().in("id", oldIds);
}

const photos = readdirSync("assets").filter((name) => name.startsWith("sobautofix-new-pictures")).sort();
const today = new Date();
const daysAgo = (days) => new Date(today.getTime() - days * 86_400_000).toISOString();

const stock = [
  { slug: "demo-2019-ford-focus-zetec", make: "Ford", model: "Focus", derivative: "1.0 EcoBoost Zetec 5dr", year: 2019, mileage: 41250, price: 9495, fuel_type: "Petrol", transmission: "Manual", body_type: "Hatchback", colour: "Blue", status: "available", listed: 6, doors: 5, seats: 5, previous_owners: 2, keys_count: 2, service_history: "full", mot_expiry: "2027-06-14", condition_summary: "Clean interior. Light stone chips on the bonnet and a small scuff on the rear bumper, shown in the photos.", known_faults: [], work_completed: ["Oil and filter service", "Two new front tyres", "Front brake pads replaced"], inspection_date: daysAgo(9).slice(0, 10), inspection_scope: "Road test, underside inspection, diagnostic scan of all modules, brake and tyre measurement.", inspection_findings: "No stored fault codes. Brake pads replaced as part of preparation. Tyres 6 mm front, 5 mm rear.", write_off_status: "none_recorded", history_check_summary: "No outstanding finance, not recorded as stolen, no insurance write-off recorded.", history_checked_on: daysAgo(10).slice(0, 10) },
  { slug: "demo-2017-vauxhall-astra-sri", make: "Vauxhall", model: "Astra", derivative: "1.4T SRi 5dr", year: 2017, mileage: 68900, price: 6750, fuel_type: "Petrol", transmission: "Manual", body_type: "Hatchback", colour: "Red", status: "available", listed: 14, doors: 5, seats: 5, previous_owners: 3, keys_count: 1, service_history: "partial", mot_expiry: "2027-02-02", condition_summary: "Good overall. Alloy wheel scuffs on two wheels; driver seat bolster wear.", known_faults: [], work_completed: ["Battery replaced", "Wiper blades replaced"], write_off_status: "not_confirmed" },
  { slug: "demo-2020-toyota-yaris-hybrid", make: "Toyota", model: "Yaris", derivative: "1.5 Hybrid Icon CVT", year: 2020, mileage: 28400, price: 13995, fuel_type: "Hybrid", transmission: "Automatic", body_type: "Hatchback", colour: "Silver", status: "reserved", listed: 20, doors: 5, seats: 5, previous_owners: 1, keys_count: 2, service_history: "full", condition_summary: "Very clean throughout with no marks of note beyond normal wear for the mileage.", known_faults: [], work_completed: ["Full service"], write_off_status: "none_recorded" },
  { slug: "demo-2015-bmw-320d-project", make: "BMW", model: "3 Series", derivative: "320d SE 4dr", year: 2015, mileage: 121000, price: 3450, fuel_type: "Diesel", transmission: "Automatic", body_type: "Saloon", colour: "Black", status: "available", listed: 3, listing_condition: "repair_project", previous_owners: 4, keys_count: 1, service_history: "none", condition_summary: "Sold as a repair project. Drives, but needs work before everyday use.", known_faults: ["Gearbox hesitates between 2nd and 3rd when cold", "Engine management light on: EGR fault code stored", "Nearside rear door does not open from outside"], work_completed: [], write_off_status: "cat_n" },
  { slug: "demo-2018-nissan-qashqai-nconnecta", make: "Nissan", model: "Qashqai", derivative: "1.5 dCi N-Connecta", year: 2018, mileage: 55300, price: 10250, fuel_type: "Diesel", transmission: "Manual", body_type: "SUV", colour: "Grey", status: "preparation", listed: null, condition_summary: "", known_faults: [], work_completed: [] },
  { slug: "demo-2016-volkswagen-polo-match", make: "Volkswagen", model: "Polo", derivative: "1.2 TSI Match 5dr", year: 2016, mileage: 72100, price: 5995, fuel_type: "Petrol", transmission: "Manual", body_type: "Hatchback", colour: "White", status: "sold", listed: 40, sold: 4, service_history: "full", condition_summary: "Tidy example with a full service history.", known_faults: [], work_completed: ["Cambelt and water pump"], write_off_status: "none_recorded" },
];

const vehicleIds = {};
for (const [index, item] of stock.entries()) {
  const { listed, sold, ...row } = item;
  const description = `${item.year} ${item.make} ${item.model} ${item.derivative}. Demo listing for local development only; not a real vehicle for sale.`;
  const data = await must(db.from("sale_vehicles").insert({
    ...row,
    description,
    features: ["Bluetooth", "Air conditioning", "DAB radio", "Cruise control"].slice(0, 2 + (index % 3)),
    finance_available: false,
    warranty: { available: false },
    listed_at: listed === null ? null : daysAgo(listed),
    created_at: daysAgo((listed ?? 1) + 5),
    sold_at: sold ? daysAgo(sold) : null,
  }).select("id").single(), `vehicle ${item.slug}`);
  vehicleIds[item.slug] = data.id;
  const count = item.status === "preparation" ? 2 : 5;
  for (let position = 0; position < count; position += 1) {
    const file = photos[(index * 2 + position) % photos.length];
    const path = `${data.id}/demo-${position}.png`;
    await db.storage.from("vehicle-sales").upload(path, readFileSync(join("assets", file)), { contentType: "image/png", upsert: true });
    await must(db.from("sale_vehicle_images").insert({ sale_vehicle_id: data.id, object_path: path, alt_text: `Demo photo ${position + 1} for the ${item.make} ${item.model} listing`, position }), "image");
  }
}

// Private records (finance roles only).
const focus = vehicleIds["demo-2019-ford-focus-zetec"];
const yaris = vehicleIds["demo-2020-toyota-yaris-hybrid"];
const polo = vehicleIds["demo-2016-volkswagen-polo-match"];
await must(db.from("vehicle_internal_records").upsert([
  { sale_vehicle_id: focus, acquired_on: daysAgo(18).slice(0, 10), acquisition_source: "customer_purchase", internal_notes: "Bought from a local customer; spare key in the safe." },
  { sale_vehicle_id: polo, acquired_on: daysAgo(55).slice(0, 10), acquisition_source: "part_exchange" },
]), "internal");
await must(db.from("vehicle_costs").insert([
  { sale_vehicle_id: focus, category: "purchase", description: "Purchase from customer", amount_pence: 690000, basis: "actual", created_by: ownerId },
  { sale_vehicle_id: focus, category: "parts", description: "Front pads and two tyres", amount_pence: 21800, basis: "actual", created_by: ownerId },
  { sale_vehicle_id: focus, category: "valeting", description: "Full valet", amount_pence: 6000, basis: "estimated", created_by: ownerId },
  { sale_vehicle_id: polo, category: "purchase", description: "Part-exchange allowance", amount_pence: 420000, basis: "actual", created_by: ownerId },
  { sale_vehicle_id: polo, category: "repair", description: "Cambelt and water pump", amount_pence: 38000, basis: "actual", created_by: ownerId },
]), "costs");
await must(db.from("vehicle_prep_items").insert([
  { sale_vehicle_id: vehicleIds["demo-2018-nissan-qashqai-nconnecta"], title: "Diagnostic scan", category: "check", status: "done", position: 0 },
  { sale_vehicle_id: vehicleIds["demo-2018-nissan-qashqai-nconnecta"], title: "Replace rear brake discs", category: "repair", status: "in_progress", position: 1 },
  { sale_vehicle_id: vehicleIds["demo-2018-nissan-qashqai-nconnecta"], title: "Full valet and photographs", category: "photos", status: "todo", position: 2 },
]), "prep");

// Customer-side records through the same functions the website uses.
const viewingStart = new Date(today); viewingStart.setDate(viewingStart.getDate() + 2); viewingStart.setHours(11, 0, 0, 0);
await db.from("enquiries").delete().like("description", "Demo:%");
await must(db.rpc("create_vehicle_enquiry", { p_payload: { idempotencyKey: crypto.randomUUID(), intent: "viewing", vehicleId: focus, name: "Demo Buyer", email: "buyer@example.test", phone: "07000 000001", preferredContact: "phone", description: "Demo: viewing request for the Focus.", message: "Is Saturday morning possible too?", preferredStart: viewingStart.toISOString() } }), "viewing");
await must(db.rpc("create_vehicle_enquiry", { p_payload: { idempotencyKey: crypto.randomUUID(), intent: "question", vehicleId: vehicleIds["demo-2017-vauxhall-astra-sri"], name: "Demo Asker", phone: "07000 000002", preferredContact: "whatsapp", description: "Demo: does the Astra have a spare key?" } }), "question");
await must(db.rpc("create_seller_submission", { p_payload: { idempotencyKey: crypto.randomUUID(), kind: "part_exchange", interestedVehicleId: focus, name: "Demo Seller", email: "seller@example.test", phone: "07000 000003", preferredContact: "email", registration: "DE12MOA", lookupSource: "manual", make: "Peugeot", model: "208", year: 2014, mileage: 88000, fuelType: "Petrol", transmission: "Manual", runningStatus: "runs_and_drives", knownFaults: "Air conditioning not cold", motStatus: "valid", serviceHistory: "partial", outstandingFinance: "no", postcode: "DN6 9HF", description: "Demo: part exchange towards the Focus." } }), "seller");
await must(db.from("vehicle_sales").insert({ sale_vehicle_id: yaris, agreed_price_pence: 1375000, deposit_pence: 20000, amount_paid_pence: 20000, payment_status: "deposit_received", payment_method: "Bank transfer", handover_method: "collection", handover_at: new Date(today.getTime() + 4 * 86_400_000).toISOString(), created_by: ownerId }), "sale");

console.log(`Seeded ${stock.length} demo vehicles. Staff logins: sobautofix@gmail.com (owner) and temitopeagbola@gmail.com (sales), password ${LOCAL_PASSWORD}`);
