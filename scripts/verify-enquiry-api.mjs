#!/usr/bin/env node
/**
 * End-to-end checks for POST /api/enquiries against a running app that is
 * connected to a LOCAL Supabase stack (never production: it creates rows).
 *
 *   npx supabase start && npx supabase db reset
 *   npm run build && npm start            # with .env.local pointing at local Supabase
 *   node scripts/verify-enquiry-api.mjs   # BASE_URL defaults to http://localhost:3000
 *
 * Reads SUPABASE_URL and the local PUBLISHABLE key from `supabase status` to
 * prove public visitors cannot read customer data directly.
 */
import { execFileSync, execSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const status = JSON.parse(execSync("npx supabase status -o json", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(status.API_URL)) throw new Error("Refusing to run against a non-local Supabase");

// After `supabase db reset` the Data API needs a moment to reconnect.
async function waitForApi() {
  for (let i = 0; i < 30; i++) {
    const r = await fetch(`${status.API_URL}/rest/v1/`, { headers: { apikey: status.PUBLISHABLE_KEY } }).catch(() => null);
    if (r && r.status < 500) return;
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error("Supabase Data API is not responding");
}
await waitForApi();

let failures = 0;
const check = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failures++;
};

const origin = new URL(BASE).origin;
const runId = Date.now().toString().slice(-5);
let ipCounter = 0;
const freshIp = () => `203.0.113.${(Number(runId) + ++ipCounter) % 250}`; // TEST-NET-3, documentation range

function quote(overrides = {}) {
  return {
    type: "quote",
    planId: "car-1",
    carBrand: "Mazda",
    carModel: "2",
    carYear: "2020",
    name: "ทดสอบ ระบบ",
    phone: `080${runId}${String(++ipCounter).padStart(2, "0")}`.slice(0, 10),
    preferredChannel: "phone",
    marketingConsent: false,
    idempotencyKey: randomUUID(),
    startedAt: Date.now() - 10_000,
    website: "",
    ...overrides,
  };
}

async function post(body, { ip = freshIp(), headers = {}, raw } = {}) {
  const res = await fetch(`${BASE}/api/enquiries`, {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-real-ip": ip, ...headers },
    body: raw ?? JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, json: await res.json().catch(() => null) };
}

async function rest(path, init = {}) {
  const res = await fetch(`${status.API_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: status.PUBLISHABLE_KEY, "content-type": "application/json", ...init.headers },
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

function sql(query) {
  return execFileSync("psql", [status.DB_URL, "-At", "-c", query], { encoding: "utf8" }).trim();
}

// --- Request shape ----------------------------------------------------------
{
  const r = await post(null, { headers: { "content-type": "text/plain" }, raw: "x" });
  check(r.status === 415, `wrong content type -> 415 (got ${r.status})`);
}
{
  const r = await post(null, { raw: "{not json" });
  check(r.status === 400 && r.json?.error === "invalid_json", `malformed JSON -> 400 invalid_json`);
}
{
  const r = await post(quote({ message: "x".repeat(20_000) }));
  check(r.status === 413, `oversized body -> 413 (got ${r.status})`);
}
{
  const r = await post(quote(), { headers: { origin: "https://evil.example" } });
  check(r.status === 403 && r.json?.error === "forbidden_origin", `cross-site origin -> 403`);
}

// --- Validation -------------------------------------------------------------
{
  const r = await post(quote({ phone: "12345", name: "" }));
  check(r.status === 400 && r.json?.fieldErrors?.phone && r.json?.fieldErrors?.name, `invalid phone and empty name -> 400 with field errors`);
}
{
  const r = await post(quote({ planId: "life-insurance" }));
  check(r.status === 400 && r.json?.fieldErrors?.planId, `unknown plan -> 400`);
}
{
  const r = await post(quote({ carYear: "1890" }));
  check(r.status === 400 && r.json?.fieldErrors?.carYear, `car year out of range -> 400`);
}
{
  const r = await post(quote({ carBrand: "", carModel: "" }));
  check(r.status === 400 && r.json?.fieldErrors?.carBrand && r.json?.fieldErrors?.carModel, `car plan without brand and model -> 400`);
}
{
  const r = await post(quote({ planId: "travel", carBrand: undefined, carModel: undefined, carYear: undefined }));
  check(r.status === 400 && r.json?.fieldErrors?.destination && r.json?.fieldErrors?.tripDays, `travel without destination and days -> 400`);
}
{
  const r = await post(quote({ planId: "compulsory" }));
  check(r.status === 400 && r.json?.fieldErrors?.vehicleType, `พ.ร.บ. without vehicle type -> 400`);
}
{
  const r = await post(quote({ renewalTiming: "yesterday" }));
  check(r.status === 400 && r.json?.fieldErrors?.renewalTiming, `unknown renewal timing -> 400`);
}
{
  const r = await post(quote({ planId: "travel", destination: "ญี่ปุ่น", tripDays: "5", tripStart: "2001-01-01" }));
  check(r.status === 400 && r.json?.fieldErrors?.tripStart, `trip start in the past -> 400`);
}
{
  const r = await post(quote({ name: "Visit https://spam.example" }));
  check(r.status === 400 && r.json?.fieldErrors?.name, `link in name -> 400`);
}
{
  const r = await post({ ...quote(), type: "contact", message: "" });
  check(r.status === 400 && r.json?.fieldErrors?.message, `contact enquiry without message -> 400`);
}

// --- Spam signals -----------------------------------------------------------
{
  const body = quote({ website: "https://bot.example" });
  const r = await post(body);
  check(r.status === 400 && r.json?.error === "rejected", `honeypot filled -> 400 rejected`);
  check(sql(`select count(*) from public.enquiries where idempotency_key = '${body.idempotencyKey}'`) === "0", `honeypot submission not stored`);
}
{
  const r = await post(quote({ startedAt: Date.now() }));
  check(r.status === 400 && r.json?.error === "rejected", `form filled instantly -> 400 rejected`);
}
{
  const r = await post({ ...quote(), type: "contact", message: "see http://a.example http://b.example http://c.example" });
  check(r.status === 400 && r.json?.error === "rejected", `message with many links -> 400 rejected`);
}

// --- Successful submission ----------------------------------------------------
const good = quote({
  marketingConsent: true, carBrand: "Toyota", carModel: "Corolla Cross", carYear: "2023",
  renewalTiming: "1_3_months", repair: "dealer", usage: "personal", evCharger: "yes", // evCharger is not a car-1 field: dropped
});
const first = await post(good);
check(first.status === 201 && first.json?.mode === "database" && /^CK-\d{6}-[A-Z0-9]{4}$/.test(first.json?.reference ?? ""),
  `valid quote -> 201 with reference ${first.json?.reference}`);
check(first.json && !("customer_id" in first.json) && !("phone" in first.json), `response contains no customer data`);

const ref = first.json?.reference;
const row = sql(`select e.type, e.product, e.status, e.source, e.contact_phone, v.description, v.model_year, c.full_name, e.client_ip_hash is not null
                 from public.enquiries e join public.customers c on c.id = e.customer_id left join public.vehicles v on v.id = e.vehicle_id
                 where e.reference = '${ref}'`);
check(row === `quote|car_1|new|web_quote_form|${good.phone}|Toyota Corolla Cross|2023|ทดสอบ ระบบ|t`, `stored enquiry, customer and vehicle are correct`);
check(sql(`select v.make || '|' || v.model || '|' || e.renewal_timing || '|' || e.details::text
           from public.enquiries e join public.vehicles v on v.id = e.vehicle_id where e.reference = '${ref}'`)
  === `Toyota|Corolla Cross|1_3_months|{"usage": "personal", "repair": "dealer"}`, `brand, model, renewal timing and car-1 details stored separately`);
check(sql(`select string_agg(purpose || '=' || granted || '@' || notice_version, ',' order by purpose)
           from public.consent_records c join public.enquiries e on e.id = c.enquiry_id where e.reference = '${ref}'`)
  === "quote_processing=true@draft-2026-10,marketing=true@draft-2026-10", `consent records stored (quote processing + marketing opt-in)`);
check(Number(sql(`select count(*) from public.audit_logs a join public.enquiries e on a.record_id = e.id::text where e.reference = '${ref}' and a.action = 'insert'`)) === 1,
  `audit log written for the new enquiry`);
check(!sql(`select string_agg(bucket_key, ',') from private.rate_limit_buckets`).includes(good.phone), `rate-limit table stores hashes, not phone numbers`);

// --- Product-specific fields ------------------------------------------------------
{
  const r = await post(quote({ planId: "ev", carBrand: "BYD", carModel: "Seal", carYear: "2025", evCharger: "yes", repair: "dealer", renewalTiming: "within_1_month" }));
  check(r.status === 201, `EV quote -> 201 (${r.json?.reference})`);
  check(sql(`select e.product || '|' || e.details::text || '|' || v.is_ev from public.enquiries e join public.vehicles v on v.id = e.vehicle_id where e.reference = '${r.json?.reference}'`)
    === `ev|{"ev_home_charger": "yes"}|true`, `EV: charger answer stored, repair choice (car-1 only) dropped`);
}
{
  const r = await post(quote({ planId: "compulsory", carBrand: "", carModel: "", carYear: "", vehicleType: "pickup", renewalTiming: "no_current_policy" }));
  check(r.status === 201, `พ.ร.บ. quote with vehicle type only -> 201 (${r.json?.reference})`);
  check(sql(`select e.product || '|' || e.details::text || '|' || e.renewal_timing || '|' || (e.vehicle_id is null) from public.enquiries e where e.reference = '${r.json?.reference}'`)
    === `compulsory|{"vehicle_type": "pickup"}|no_current_policy|true`, `พ.ร.บ.: vehicle type stored, no empty vehicle row`);
}
{
  const start = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
  const r = await post(quote({ planId: "travel", destination: "ญี่ปุ่น", tripStart: start, tripDays: "7", travellers: "2", usage: "personal" }));
  check(r.status === 201, `travel quote -> 201 (${r.json?.reference})`);
  check(sql(`select e.product || '|' || e.travel_destination || '|' || e.travel_days || '|' || e.travellers || '|' || e.details::text || '|' || (e.vehicle_id is null)
             from public.enquiries e where e.reference = '${r.json?.reference}'`)
    === `travel|ญี่ปุ่น|7|2|{"trip_start": "${start}"}|true`, `travel: destination, dates and travellers stored; car fields ignored`);
}

// --- Duplicate handling ---------------------------------------------------------
{
  const r = await post(good);
  check(r.status === 200 && r.json?.duplicate === true && r.json?.reference === ref, `same idempotency key -> 200 duplicate, same reference`);
}
{
  const r = await post({ ...good, idempotencyKey: randomUUID(), name: "ทดสอบ ระบบ (กดซ้ำ)" });
  check(r.status === 200 && r.json?.duplicate === true && r.json?.reference === ref, `same request with a new key within 30 min -> duplicate`);
}
{
  const body = quote();
  const results = await Promise.all(Array.from({ length: 5 }, () => post(body, { ip: freshIp() })));
  const refs = new Set(results.map((r) => r.json?.reference));
  check(refs.size === 1 && results.filter((r) => r.status === 201).length === 1, `5 concurrent identical submissions -> 1 stored, 4 duplicates`);
}
check(sql(`select count(*) from public.enquiries where contact_phone = '${good.phone}'`) === "1", `only one enquiry row for the duplicated request`);

// --- Rate limits ------------------------------------------------------------------
{
  const ip = freshIp();
  const statuses = [];
  let last;
  for (let i = 0; i < 6; i++) {
    last = await post(quote(), { ip });
    statuses.push(last.status);
  }
  check(statuses.slice(0, 5).every((s) => s === 201) && statuses[5] === 429, `6th request from one IP in 10 min -> 429 (${statuses.join(",")})`);
  check(Number(last.headers.get("retry-after")) > 0, `429 includes Retry-After (${last.headers.get("retry-after")}s)`);
}
{
  const phone = `0899${runId}9`.slice(0, 10);
  const statuses = [];
  for (let i = 0; i < 6; i++) {
    const r = await post(quote({ phone, carModel: `Car ${i}` }), { ip: freshIp() });
    statuses.push(r.status);
  }
  check(statuses[5] === 429, `6th request for one phone number from different IPs -> 429 (${statuses.join(",")})`);
}

// --- Public visitors cannot read or write through the Supabase API directly ------------
{
  const r = await rest("customers?select=*");
  check(r.status >= 400, `publishable key: GET customers denied (${r.status})`);
}
{
  const r = await rest("enquiries?select=reference");
  check(r.status >= 400, `publishable key: GET enquiries denied (${r.status})`);
}
{
  const r = await rest("customers", { method: "POST", body: JSON.stringify({ full_name: "x", phone: "0811111111" }) });
  check(r.status >= 400, `publishable key: INSERT customers denied (${r.status})`);
}
{
  const r = await rest("rpc/submit_enquiry", { method: "POST", body: JSON.stringify({ p: { type: "quote" } }) });
  check(r.status >= 400, `publishable key: cannot call submit_enquiry directly (${r.status})`);
}
{
  const r = await rest("rpc/consume_rate_limit", { method: "POST", body: JSON.stringify({ p_bucket_key: "x", p_limit: 1, p_window_seconds: 60 }) });
  check(r.status >= 400, `publishable key: cannot call consume_rate_limit (${r.status})`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
process.exit(failures ? 1 : 0);
