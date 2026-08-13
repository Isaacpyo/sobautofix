import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createLocalClient,
  executeLocalOwnerSql,
  getLocalSupabaseConfig,
  invoiceDraftPayload,
  provisionLocalTestUsers,
  type LocalTestUsers,
} from "../helpers/local-supabase";

let users: LocalTestUsers;

beforeAll(async () => {
  users = await provisionLocalTestUsers();
});

describe.sequential("local Supabase invoice authorization", () => {
  it("enforces the anon, non-admin and admin PostgREST role matrix", async () => {
    const anonRead = await users.anon.from("invoices").select("id").limit(1);
    expect(anonRead.error?.code).toBe("42501");

    const nonAdminRead = await users.nonAdmin.from("invoices").select("id").limit(1);
    expect(nonAdminRead.error).toBeNull();
    expect(nonAdminRead.data).toEqual([]);

    const nonAdminSave = await users.nonAdmin.rpc("save_invoice_draft", {
      p_invoice_id: null,
      p_payload: invoiceDraftPayload("2096-01-02", "nonadmin"),
      p_confirm_duplicate_source: false,
    });
    expect(nonAdminSave.error?.message).toContain("UNAUTHORISED");

    const draftId = await saveDraft(users.admin, "2096-01-02", "role-matrix");
    const adminRead = await users.admin.from("invoices").select("id,status").eq("id", draftId).single();
    expect(adminRead.error).toBeNull();
    expect(adminRead.data).toMatchObject({ id: draftId, status: "draft" });

    const directInvoiceWrite = await users.admin
      .from("invoices")
      .update({ subtotal_pence: 777 })
      .eq("id", draftId)
      .select("id");
    expect(directInvoiceWrite.error?.code).toBe("42501");

    const directItemWrite = await users.admin.from("invoice_items").insert({
      invoice_id: draftId,
      description: "Direct browser mutation",
      quantity: "1",
      unit_price_pence: 1,
      line_total_pence: 1,
    });
    expect(directItemWrite.error?.code).toBe("42501");

    const sequenceRead = await users.admin.from("invoice_number_sequences").select("invoice_year").limit(1);
    expect(sequenceRead.error?.code).toBe("42501");

    const anonIssue = await users.anon.rpc("issue_invoice", { p_invoice_id: draftId });
    expect(anonIssue.error?.code).toBe("42501");
  });

  it("denies every sensitive invoice RPC to anonymous and non-admin callers", async () => {
    const invoiceId = randomUUID();
    const logicalSendId = randomUUID();
    const claimToken = randomUUID();
    const calls = [
      ["save_invoice_draft", {
        p_invoice_id: null,
        p_payload: invoiceDraftPayload("2091-01-01", "denied"),
        p_confirm_duplicate_source: false,
      }],
      ["issue_invoice", { p_invoice_id: invoiceId }],
      ["mark_invoice_paid", { p_invoice_id: invoiceId, p_paid_at: new Date().toISOString(), p_method: "cash", p_reference: "" }],
      ["void_invoice", { p_invoice_id: invoiceId }],
      ["delete_invoice_draft", { p_invoice_id: invoiceId }],
      ["duplicate_invoice_to_draft", { p_invoice_id: invoiceId }],
      ["claim_invoice_email_send", {
        p_invoice_id: invoiceId,
        p_recipient: "denied@example.test",
        p_logical_send_id: logicalSendId,
        p_invoice_revision: 1,
        p_payload_sha256: "a".repeat(64),
      }],
      ["get_invoice_dashboard", {
        p_query: null,
        p_status: null,
        p_date: null,
        p_page: 1,
        p_page_size: 25,
      }],
      ["finalize_invoice_email_send", { p_attempt_id: 1, p_claim_token: claimToken, p_provider_id: "denied" }],
      ["fail_invoice_email_send", {
        p_attempt_id: 1,
        p_claim_token: claimToken,
        p_error_code: "denied",
        p_ambiguous: false,
        p_provider_id: null,
      }],
    ] as const;

    for (const [name, args] of calls) {
      const [anonResult, nonAdminResult] = await Promise.all([
        users.anon.rpc(name, args),
        users.nonAdmin.rpc(name, args),
      ]);
      expect(anonResult.error?.code, `anon ${name}`).toBe("42501");
      expect(nonAdminResult.error?.code, `non-admin ${name}`).toBe("42501");
    }
  });

  it("rejects direct REST mutation of issued invoice history", async () => {
    const draftId = await saveDraft(users.admin, "2090-08-11", "rest-immutable");
    const issue = await users.admin.rpc("issue_invoice", { p_invoice_id: draftId });
    expect(issue.error).toBeNull();

    const item = await users.admin
      .from("invoice_items")
      .select("id")
      .eq("invoice_id", draftId)
      .single();
    expect(item.error).toBeNull();

    const invoiceMutations = [
      users.admin.from("invoices").update({ status: "paid" }).eq("id", draftId),
      users.admin.from("invoices").update({ total_pence: 1 }).eq("id", draftId),
      users.admin.from("invoices").update({ invoice_number: "SOB-2090-999999" }).eq("id", draftId),
      users.admin.from("invoices").update({ tax_pence: 1 }).eq("id", draftId),
      users.admin.from("invoices").delete().eq("id", draftId),
      users.admin.from("invoice_items").update({ quantity: "2" }).eq("id", item.data!.id),
      users.admin.from("invoice_items").delete().eq("id", item.data!.id),
    ];
    const results = await Promise.all(invoiceMutations);
    expect(results).toHaveLength(7);
    for (const result of results) expect(result.error?.code).toBe("42501");
  });

  it("requires deliberate confirmation before duplicating a persisted booking invoice", async () => {
    const customerId = randomUUID();
    const vehicleId = randomUUID();
    const bookingId = randomUUID();
    const fixtureSuffix = randomUUID().replaceAll("-", "").slice(0, 8);
    const customer = {
      name: "Duplicate Booking Customer",
      email: `duplicate-booking-${fixtureSuffix}@example.test`,
      phone: "07111111111",
    };
    const vehicle = { registration: `DB${fixtureSuffix}`.toUpperCase(), make: "Test", model: "Booking" };
    const appointmentStart = "2092-05-10T09:00:00.000Z";

    executeLocalOwnerSql(
      `
        insert into public.customers (id, name, email, phone, preferred_contact)
        values (:'customer_id'::uuid, :'customer_name', :'customer_email', :'customer_phone', 'email');
        insert into public.vehicles (id, customer_id, registration, make, model)
        values (:'vehicle_id'::uuid, :'customer_id'::uuid, :'registration', :'make', :'model');
        insert into public.bookings (
          id, customer_id, vehicle_id, service_name, appointment_start, original_appointment_start
        ) values (
          :'booking_id'::uuid, :'customer_id'::uuid, :'vehicle_id'::uuid,
          'Persisted booking service', :'appointment_start'::timestamptz, :'appointment_start'::timestamptz
        );
      `,
      {
        customer_id: customerId,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        vehicle_id: vehicleId,
        registration: vehicle.registration,
        make: vehicle.make,
        model: vehicle.model,
        booking_id: bookingId,
        appointment_start: appointmentStart,
      },
    );

    const payload = {
      ...invoiceDraftPayload("2092-05-10", "booking-source"),
      source_type: "booking",
      booking_id: bookingId,
      customer_id: customerId,
      vehicle_id: vehicleId,
      customer_name: customer.name,
      customer_email: customer.email,
      customer_phone: customer.phone,
      vehicle_registration: vehicle.registration,
      vehicle_make: vehicle.make,
      vehicle_model: vehicle.model,
      service_name: "Persisted booking service",
      appointment_start: appointmentStart,
      items: [{ description: "Persisted booking service", quantity: "1", unit_price_pence: "5000" }],
    };

    const first = await users.admin.rpc("save_invoice_draft", {
      p_invoice_id: null,
      p_payload: payload,
      p_confirm_duplicate_source: false,
    });
    expect(first.error).toBeNull();
    expect(first.data).toBeTruthy();

    const firstIssue = await users.admin.rpc("issue_invoice", { p_invoice_id: first.data });
    expect(firstIssue.error).toBeNull();
    const firstVoid = await users.admin.rpc("void_invoice", { p_invoice_id: first.data });
    expect(firstVoid.error).toBeNull();

    const unconfirmedDuplicate = await users.admin.rpc("save_invoice_draft", {
      p_invoice_id: null,
      p_payload: payload,
      p_confirm_duplicate_source: false,
    });
    expect(unconfirmedDuplicate.error?.message).toContain("DUPLICATE_SOURCE_CONFIRMATION_REQUIRED");

    const confirmedDuplicate = await users.admin.rpc("save_invoice_draft", {
      p_invoice_id: null,
      p_payload: payload,
      p_confirm_duplicate_source: true,
    });
    expect(confirmedDuplicate.error).toBeNull();
    expect(confirmedDuplicate.data).toBeTruthy();
    expect(confirmedDuplicate.data).not.toBe(first.data);

    const unrelatedCustomerId = randomUUID();
    executeLocalOwnerSql(
      `
        insert into public.customers (id, name, email, phone, preferred_contact)
        values (:'customer_id'::uuid, 'Unrelated local customer', :'customer_email', '07222222222', 'email');
      `,
      { customer_id: unrelatedCustomerId, customer_email: `unrelated-${fixtureSuffix}@example.test` },
    );

    const forgedRelationship = await users.admin.rpc("save_invoice_draft", {
      p_invoice_id: null,
      p_payload: { ...payload, customer_id: unrelatedCustomerId },
      p_confirm_duplicate_source: true,
    });
    expect(forgedRelationship.error?.message).toContain("SOURCE_RELATIONSHIP_MISMATCH");

    const racedBookingId = randomUUID();
    const racedAppointment = "2092-06-10T09:00:00.000Z";
    executeLocalOwnerSql(
      `
        insert into public.bookings (
          id, customer_id, vehicle_id, service_name, appointment_start, original_appointment_start
        ) values (
          :'booking_id'::uuid, :'customer_id'::uuid, :'vehicle_id'::uuid,
          'Raced persisted booking', :'appointment_start'::timestamptz, :'appointment_start'::timestamptz
        );
      `,
      {
        booking_id: racedBookingId,
        customer_id: customerId,
        vehicle_id: vehicleId,
        appointment_start: racedAppointment,
      },
    );

    const racedPayload = {
      ...payload,
      booking_id: racedBookingId,
      service_name: "Raced persisted booking",
      appointment_start: racedAppointment,
      items: [{ description: "Raced persisted booking", quantity: "1", unit_price_pence: "5000" }],
    };
    const [firstClient, secondClient] = independentAdminClients(users.adminIdentity.accessToken, 2);
    const racedResults = await Promise.all([
      firstClient!.rpc("save_invoice_draft", {
        p_invoice_id: null,
        p_payload: racedPayload,
        p_confirm_duplicate_source: false,
      }),
      secondClient!.rpc("save_invoice_draft", {
        p_invoice_id: null,
        p_payload: racedPayload,
        p_confirm_duplicate_source: false,
      }),
    ]);
    expect(racedResults.filter((result) => !result.error)).toHaveLength(1);
    expect(racedResults.filter((result) => result.error?.message.includes("DUPLICATE_SOURCE_CONFIRMATION_REQUIRED"))).toHaveLength(1);

    const changedBookingId = randomUUID();
    const changedAppointment = "2092-07-10T09:00:00.000Z";
    executeLocalOwnerSql(
      `
        insert into public.bookings (
          id, customer_id, vehicle_id, service_name, appointment_start, original_appointment_start
        ) values (
          :'booking_id'::uuid, :'customer_id'::uuid, :'vehicle_id'::uuid,
          'Relationship drift', :'appointment_start'::timestamptz, :'appointment_start'::timestamptz
        );
      `,
      {
        booking_id: changedBookingId,
        customer_id: customerId,
        vehicle_id: vehicleId,
        appointment_start: changedAppointment,
      },
    );
    const changedDraft = await users.admin.rpc("save_invoice_draft", {
      p_invoice_id: null,
      p_payload: {
        ...payload,
        booking_id: changedBookingId,
        service_name: "Relationship drift",
        appointment_start: changedAppointment,
      },
      p_confirm_duplicate_source: false,
    });
    expect(changedDraft.error).toBeNull();
    expect(changedDraft.data).toBeTruthy();
    const changedDraftId = String(changedDraft.data);

    executeLocalOwnerSql(
      `update public.bookings set customer_id = :'customer_id'::uuid where id = :'booking_id'::uuid;`,
      { booking_id: changedBookingId, customer_id: unrelatedCustomerId },
    );
    const changedIssue = await users.admin.rpc("issue_invoice", { p_invoice_id: changedDraftId });
    expect(changedIssue.error?.message ?? "").toContain("SOURCE_RELATIONSHIP_CHANGED");
    const unchangedDraft = await users.admin
      .from("invoices")
      .select("status,invoice_number")
      .eq("id", changedDraftId)
      .single();
    expect(unchangedDraft.data).toEqual({ status: "draft", invoice_number: null });
  });
});

describe.sequential("local Supabase invoice dashboard", () => {
  it("searches and paginates beyond API row caps while returning exact global metrics", async () => {
    const before = await dashboardQuery();
    const beforeDrafts = BigInt(before.draft_count);
    const beforeOutstanding = BigInt(before.outstanding_count);
    const beforeOutstandingTotal = BigInt(before.outstanding_total_pence);
    const marker = `dashboard-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
    const registration = `ZX${randomUUID().replaceAll("-", "").slice(0, 8)}`.toUpperCase();

    executeLocalOwnerSql(
      `
        insert into public.invoices (
          source_type, customer_name, vehicle_registration, issue_date, created_by, updated_by
        )
        select
          'manual',
          :'marker' || '-' || series::text,
          case when series = 1 then :'registration' else null end,
          '2077-05-06'::date,
          :'actor_id'::uuid,
          :'actor_id'::uuid
        from generate_series(1, 1005) series;
      `,
      { actor_id: users.adminIdentity.id, marker, registration },
    );

    const finalPage = await dashboardQuery({
      p_query: marker,
      p_status: "draft",
      p_date: "2077-05-06",
      p_page: 999,
      p_page_size: 25,
    });
    expect(finalPage.matching_count).toBe("1005");
    expect(finalPage.page).toBe(41);
    expect(finalPage.pages).toBe(41);
    expect(finalPage.invoices).toHaveLength(5);
    expect(finalPage.draft_count).toBe(String(beforeDrafts + 1005n));

    const registrationSearch = await dashboardQuery({
      p_query: `${registration.slice(0, 2)} ${registration.slice(2)}`,
      p_status: "draft",
      p_date: null,
      p_page: 1,
      p_page_size: 25,
    });
    expect(registrationSearch.matching_count).toBe("1");
    expect(registrationSearch.invoices[0]?.vehicle_registration).toBe(registration);

    const issuedId = await saveDraft(users.admin, "2078-01-01", "dashboard-outstanding");
    const issued = await users.admin.rpc("issue_invoice", { p_invoice_id: issuedId });
    expect(issued.error).toBeNull();
    const afterIssue = await dashboardQuery();
    expect(afterIssue.outstanding_count).toBe(String(beforeOutstanding + 1n));
    expect(afterIssue.outstanding_total_pence).toBe(String(beforeOutstandingTotal + 999n));
  });
});

describe.sequential("local Supabase invoice numbering", () => {
  it("does not allocate a number when a draft is created and deleted", async () => {
    const deletedDraft = await saveDraft(users.admin, "2093-01-10", "delete-before-issue");
    const deleted = await users.admin.rpc("delete_invoice_draft", { p_invoice_id: deletedDraft });
    expect(deleted.error).toBeNull();
    expect(deleted.data).toBe(deletedDraft);

    const nextDraft = await saveDraft(users.admin, "2093-02-10", "first-issued");
    const issued = await users.admin.rpc("issue_invoice", { p_invoice_id: nextDraft });
    expect(issued.error).toBeNull();
    expect(issued.data).toMatchObject({ invoice_number: "SOB-2093-000001", invoice_sequence: 1 });
  });

  it("allocates unique contiguous numbers under concurrent issue requests", async () => {
    const count = 20;
    const ids = await Promise.all(
      Array.from({ length: count }, (_, index) => saveDraft(users.admin, "2097-06-15", `concurrent-${index}`)),
    );

    const beforeIssue = await users.admin
      .from("invoices")
      .select("id,invoice_number")
      .in("id", ids);
    expect(beforeIssue.error).toBeNull();
    expect(beforeIssue.data).toHaveLength(count);
    expect(beforeIssue.data?.every((invoice) => invoice.invoice_number === null)).toBe(true);

    const clients = independentAdminClients(users.adminIdentity.accessToken, count);
    const results = await Promise.all(
      ids.map((id, index) => clients[index]!.rpc("issue_invoice", { p_invoice_id: id })),
    );
    expect(results.filter((result) => result.error)).toEqual([]);

    const issued = await users.admin
      .from("invoices")
      .select("id,status,invoice_number,invoice_year,invoice_sequence")
      .in("id", ids);
    expect(issued.error).toBeNull();
    expect(issued.data).toHaveLength(count);

    const numbers = issued.data?.map((invoice) => invoice.invoice_number) ?? [];
    expect(new Set(numbers).size).toBe(count);
    expect(numbers.every((number) => /^SOB-2097-\d{6}$/.test(String(number)))).toBe(true);
    expect(issued.data?.every((invoice) => invoice.status === "issued" && Number(invoice.invoice_year) === 2097)).toBe(true);
    expect(issued.data?.map((invoice) => Number(invoice.invoice_sequence)).sort((a, b) => a - b)).toEqual(
      Array.from({ length: count }, (_, index) => index + 1),
    );
  });

  it("issues the same draft once when two requests race", async () => {
    const draftId = await saveDraft(users.admin, "2098-03-01", "same-draft");
    const [first, second] = independentAdminClients(users.adminIdentity.accessToken, 2);
    const results = await Promise.all([
      first!.rpc("issue_invoice", { p_invoice_id: draftId }),
      second!.rpc("issue_invoice", { p_invoice_id: draftId }),
    ]);

    expect(results.filter((result) => !result.error)).toHaveLength(1);
    expect(results.filter((result) => result.error)).toHaveLength(1);

    const issued = await users.admin
      .from("invoices")
      .select("status,invoice_number,invoice_sequence")
      .eq("id", draftId)
      .single();
    expect(issued.error).toBeNull();
    expect(issued.data).toMatchObject({
      status: "issued",
      invoice_number: "SOB-2098-000001",
      invoice_sequence: 1,
    });
  });

  it("uses independent yearly sequences and never reuses a void number", async () => {
    const previousYear = await saveDraft(users.admin, "2094-12-31", "previous-year");
    const nextYear = await saveDraft(users.admin, "2095-01-01", "next-year");
    const issueResults = await Promise.all([
      users.admin.rpc("issue_invoice", { p_invoice_id: previousYear }),
      users.admin.rpc("issue_invoice", { p_invoice_id: nextYear }),
    ]);
    expect(issueResults.every((result) => !result.error)).toBe(true);

    const voidResult = await users.admin.rpc("void_invoice", { p_invoice_id: nextYear });
    expect(voidResult.error).toBeNull();
    const replacement = await saveDraft(users.admin, "2095-02-01", "after-void");
    const replacementIssue = await users.admin.rpc("issue_invoice", { p_invoice_id: replacement });
    expect(replacementIssue.error).toBeNull();

    const rows = await users.admin
      .from("invoices")
      .select("id,status,invoice_number,invoice_sequence")
      .in("id", [previousYear, nextYear, replacement]);
    expect(rows.error).toBeNull();
    const byId = new Map(rows.data?.map((row) => [row.id, row]));
    expect(byId.get(previousYear)).toMatchObject({ invoice_number: "SOB-2094-000001", invoice_sequence: 1 });
    expect(byId.get(nextYear)).toMatchObject({ status: "void", invoice_number: "SOB-2095-000001", invoice_sequence: 1 });
    expect(byId.get(replacement)).toMatchObject({ invoice_number: "SOB-2095-000002", invoice_sequence: 2 });
  });
});

describe.sequential("local Supabase invoice settlement and email delivery", () => {
  it("validates payment date and method at the database boundary", async () => {
    const invoiceId = await saveDraft(users.admin, "2089-01-10", "settlement");
    const issue = await users.admin.rpc("issue_invoice", { p_invoice_id: invoiceId });
    expect(issue.error).toBeNull();

    const noDate = await users.admin.rpc("mark_invoice_paid", {
      p_invoice_id: invoiceId,
      p_paid_at: null,
      p_method: "card",
      p_reference: "",
    });
    expect(noDate.error?.message).toContain("PAYMENT_DATE_REQUIRED");

    const invalidMethod = await users.admin.rpc("mark_invoice_paid", {
      p_invoice_id: invoiceId,
      p_paid_at: new Date().toISOString(),
      p_method: "cheque",
      p_reference: "",
    });
    expect(invalidMethod.error?.message).toContain("INVALID_PAYMENT_METHOD");
  });

  it("serializes email claims and supports conclusive failure, retry and finalize", async () => {
    const invoiceId = await saveDraft(users.admin, "2088-01-10", "email-ledger");
    const issue = await users.admin.rpc("issue_invoice", { p_invoice_id: invoiceId });
    expect(issue.error).toBeNull();

    const invoice = await users.admin
      .from("invoices")
      .select("revision")
      .eq("id", invoiceId)
      .single();
    expect(invoice.error).toBeNull();

    const logicalSendId = randomUUID();
    const payloadSha256 = "a".repeat(64);
    const claimArgs = {
      p_invoice_id: invoiceId,
      p_recipient: "EMAIL-LEDGER@EXAMPLE.TEST",
      p_logical_send_id: logicalSendId,
      p_invoice_revision: Number(invoice.data!.revision),
      p_payload_sha256: payloadSha256,
    };
    const [firstClient, secondClient] = independentAdminClients(users.adminIdentity.accessToken, 2);
    const claims = await Promise.all([
      firstClient!.rpc("claim_invoice_email_send", claimArgs),
      secondClient!.rpc("claim_invoice_email_send", claimArgs),
    ]);
    expect(claims.every((claim) => !claim.error)).toBe(true);
    const claimRows = claims.map((claim) => claim.data?.[0]);
    const initial = claimRows.find((claim) => claim?.should_send === true);
    const concurrent = claimRows.find((claim) => claim?.disposition === "in_progress");
    expect(initial).toBeTruthy();
    expect(concurrent).toBeTruthy();
    expect(concurrent?.should_send).toBe(false);
    expect(concurrent?.attempt_id).toBe(initial?.attempt_id);
    expect(concurrent?.provider_idempotency_key).toBe(initial?.provider_idempotency_key);

    const voidWhileSending = await users.admin.rpc("void_invoice", { p_invoice_id: invoiceId });
    expect(voidWhileSending.error?.message).toContain("INVOICE_EMAIL_SEND_IN_PROGRESS");

    const failed = await users.service.rpc("fail_invoice_email_send", {
      p_attempt_id: initial!.attempt_id,
      p_claim_token: initial!.claim_token,
      p_error_code: "provider_rejected",
      p_ambiguous: false,
      p_provider_id: null,
    });
    expect(failed.error).toBeNull();

    // Exercise attribution across an administrator handover: the deployment
    // permits one authorised admin email at a time, so transfer that identity
    // to the second authenticated user only for the retry claim.
    const displacedAdminEmail = `invoice-displaced-${randomUUID()}@example.test`;
    const retry = await (async () => {
      executeLocalOwnerSql(
        `
          begin;
          update auth.users set email = :'displaced_email' where id = :'original_admin_id'::uuid;
          update auth.users set email = :'admin_email' where id = :'retry_admin_id'::uuid;
          insert into public.admin_profiles (user_id, display_name)
          values (:'retry_admin_id'::uuid, 'Replacement Invoice Test Admin')
          on conflict (user_id) do update set display_name = excluded.display_name;
          commit;
        `,
        {
          displaced_email: displacedAdminEmail,
          original_admin_id: users.adminIdentity.id,
          admin_email: users.adminIdentity.email,
          retry_admin_id: users.nonAdminIdentity.id,
        },
      );
      try {
        return await users.nonAdmin.rpc("claim_invoice_email_send", claimArgs);
      } finally {
        executeLocalOwnerSql(
          `
            begin;
            delete from public.admin_profiles where user_id = :'retry_admin_id'::uuid;
            update auth.users set email = :'retry_email' where id = :'retry_admin_id'::uuid;
            update auth.users set email = :'admin_email' where id = :'original_admin_id'::uuid;
            commit;
          `,
          {
            retry_admin_id: users.nonAdminIdentity.id,
            retry_email: users.nonAdminIdentity.email,
            admin_email: users.adminIdentity.email,
            original_admin_id: users.adminIdentity.id,
          },
        );
      }
    })();
    expect(retry.error).toBeNull();
    expect(retry.data?.[0]).toMatchObject({
      disposition: "failed_retry",
      should_send: true,
      provider_idempotency_key: initial!.provider_idempotency_key,
    });
    expect(retry.data?.[0].attempt_id).not.toBe(initial!.attempt_id);

    const finalized = await users.service.rpc("finalize_invoice_email_send", {
      p_attempt_id: retry.data![0].attempt_id,
      p_claim_token: retry.data![0].claim_token,
      p_provider_id: "provider-message-1",
    });
    expect(finalized.error).toBeNull();

    const [logicalSendActors, retryAttemptActor] = await Promise.all([
      users.admin
        .from("invoice_email_sends")
        .select("requested_by")
        .eq("id", logicalSendId)
        .single(),
      users.admin
        .from("invoice_email_attempts")
        .select("attempted_by")
        .eq("id", retry.data![0].attempt_id)
        .single(),
    ]);
    expect(logicalSendActors.error).toBeNull();
    expect(retryAttemptActor.error).toBeNull();
    expect(logicalSendActors.data?.requested_by).toBe(users.adminIdentity.id);
    expect(retryAttemptActor.data?.attempted_by).toBe(users.nonAdminIdentity.id);

    const sentAudit = await users.admin
      .from("admin_audit_log")
      .select("actor_id,detail")
      .eq("action", "invoice.sent")
      .eq("entity_id", invoiceId)
      .single();
    expect(sentAudit.error).toBeNull();
    expect(sentAudit.data?.actor_id).toBe(users.nonAdminIdentity.id);
    expect(sentAudit.data?.detail).toMatchObject({ attemptId: retry.data![0].attempt_id });

    const alreadySent = await users.admin.rpc("claim_invoice_email_send", claimArgs);
    expect(alreadySent.error).toBeNull();
    expect(alreadySent.data?.[0]).toMatchObject({ disposition: "already_sent", should_send: false });

    const attempts = await users.admin
      .from("invoice_email_attempts")
      .select("attempt_number,status,error_code,provider_id")
      .eq("logical_send_id", logicalSendId)
      .order("attempt_number");
    expect(attempts.error).toBeNull();
    expect(attempts.data).toEqual([
      { attempt_number: 1, status: "failed", error_code: "provider_rejected", provider_id: null },
      { attempt_number: 2, status: "sent", error_code: null, provider_id: "provider-message-1" },
    ]);
  });

  it("requires reconciliation without a blind retry and preserves known provider evidence", async () => {
    const invoiceId = await saveDraft(users.admin, "2087-01-10", "email-reconciliation");
    const issue = await users.admin.rpc("issue_invoice", { p_invoice_id: invoiceId });
    expect(issue.error).toBeNull();

    const logicalSendId = randomUUID();
    const claimArgs = {
      p_invoice_id: invoiceId,
      p_recipient: "reconciliation@example.test",
      p_logical_send_id: logicalSendId,
      p_invoice_revision: Number(issue.data!.revision),
      p_payload_sha256: "b".repeat(64),
    };
    const initial = await users.admin.rpc("claim_invoice_email_send", claimArgs);
    expect(initial.error).toBeNull();
    expect(initial.data?.[0]).toMatchObject({ disposition: "should_send", should_send: true });

    const ambiguous = await users.service.rpc("fail_invoice_email_send", {
      p_attempt_id: initial.data![0].attempt_id,
      p_claim_token: initial.data![0].claim_token,
      p_error_code: "finalize_persistence_failed",
      p_ambiguous: true,
      p_provider_id: "provider-known-message",
    });
    expect(ambiguous.error).toBeNull();

    const reconciliation = await users.admin.rpc("claim_invoice_email_send", claimArgs);
    expect(reconciliation.error).toBeNull();
    expect(reconciliation.data?.[0]).toMatchObject({
      disposition: "reconciliation_required",
      should_send: false,
      attempt_id: initial.data![0].attempt_id,
      provider_idempotency_key: initial.data![0].provider_idempotency_key,
    });

    const conflictingFinalize = await users.service.rpc("finalize_invoice_email_send", {
      p_attempt_id: initial.data![0].attempt_id,
      p_claim_token: initial.data![0].claim_token,
      p_provider_id: "different-provider-message",
    });
    expect(conflictingFinalize.error?.message).toContain("EMAIL_PROVIDER_CONFIRMATION_MISMATCH");

    const beforeReconciliation = await users.admin
      .from("invoice_email_attempts")
      .select("status,provider_id")
      .eq("logical_send_id", logicalSendId);
    expect(beforeReconciliation.error).toBeNull();
    expect(beforeReconciliation.data).toEqual([
      { status: "ambiguous", provider_id: "provider-known-message" },
    ]);

    const finalized = await users.service.rpc("finalize_invoice_email_send", {
      p_attempt_id: initial.data![0].attempt_id,
      p_claim_token: initial.data![0].claim_token,
      p_provider_id: "provider-known-message",
    });
    expect(finalized.error).toBeNull();
  });
});

async function saveDraft(client: SupabaseClient, issueDate: string, suffix: string) {
  const { data, error } = await client.rpc("save_invoice_draft", {
    p_invoice_id: null,
    p_payload: invoiceDraftPayload(issueDate, suffix),
    p_confirm_duplicate_source: false,
  });
  if (error || !data) throw new Error(`Could not create local invoice draft: ${error?.message}`);
  return String(data);
}

function independentAdminClients(accessToken: string, count: number) {
  const { publishableKey } = getLocalSupabaseConfig();
  return Array.from({ length: count }, () => createLocalClient(publishableKey, accessToken));
}

async function dashboardQuery(overrides: Record<string, unknown> = {}) {
  const { data, error } = await users.admin.rpc("get_invoice_dashboard", {
    p_query: null,
    p_status: null,
    p_date: null,
    p_page: 1,
    p_page_size: 25,
    ...overrides,
  });
  if (error || !data || Array.isArray(data)) throw new Error(`Could not query local invoice dashboard: ${error?.message}`);
  return data as {
    invoices: Array<{ vehicle_registration: string | null }>;
    matching_count: string;
    page: number;
    pages: number;
    draft_count: string;
    outstanding_count: string;
    paid_count: string;
    outstanding_total_pence: string;
  };
}
