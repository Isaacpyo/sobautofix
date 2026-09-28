import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { serviceCatalogue } from "@/config/service-catalogue";

function source(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("shared service catalogue", () => {
  it("seeds every established vehicle system and service into the database catalogue", () => {
    const migration = source("supabase/migrations/20260928131539_unify_service_catalogue.sql");
    for (const system of serviceCatalogue) {
      expect(migration).toContain(`'${system.id}'`);
      for (const service of system.services) expect(migration).toContain(`'${service.replaceAll("'", "''")}'`);
    }
    expect(migration).toContain("create table public.service_catalogue_systems");
    expect(migration).toContain("add column system_id uuid references public.service_catalogue_systems(id)");
  });

  it("uses the database catalogue for booking, invoices and the public portfolio", () => {
    const booking = source("src/lib/bookings/services.ts");
    const invoice = source("src/components/admin/invoice-form.tsx");
    const publicCatalogue = source("src/components/services/service-catalogue.tsx");
    expect(booking).toContain("listServiceCatalogue({ bookableOnly: true })");
    expect(invoice).toContain("serviceCategories={serviceCategories}");
    expect(publicCatalogue).toContain("await listServiceCatalogue()");
  });

  it("presents vehicle systems before their services in the customer booking flow", () => {
    const wizard = source("src/components/booking/booking-wizard.tsx");
    expect(wizard).toContain("1. Choose the vehicle system");
    expect(wizard).toContain("2. Choose a service under");
    expect(wizard).toContain("systemKey");
    expect(wizard).toContain('view === "systems"');
    expect(wizard).toContain("Other / Fault not listed");
    expect(wizard).toContain("Add another vehicle system repair");
    expect(wizard).toContain("Clear selection");
    expect(wizard).toContain('services: [...system.services].sort((left, right) => left.name.localeCompare(right.name, "en-GB"))');
    expect(wizard).toContain('.sort((left, right) => left.name.localeCompare(right.name, "en-GB"));');
    expect(wizard).toContain('const allSystems = [...systems, { key: "other", name: "Other / Fault not listed", services: [] as BookingService[] }];');
    expect(wizard).not.toContain("{system.description}");
    expect(wizard).not.toContain("{system.services.length} services");
    expect(wizard).not.toContain("{service.description}");
    expect(wizard).not.toContain("locationModeLabel(service.locationMode)");
  });

  it("provides an editable CMS portfolio and recoverable deletion", () => {
    const page = source("src/app/admin/(protected)/service-catalogue/page.tsx");
    const editor = source("src/app/admin/(protected)/service-catalogue/catalogue-editor.tsx");
    const trash = source("src/app/admin/(protected)/trash/actions.ts");
    expect(page).toContain("Service catalogue");
    expect(editor).toContain("createCatalogueSystemAction");
    expect(editor).toContain("updateCatalogueServiceAction");
    expect(trash).toContain('"catalogue_systems"');
    expect(trash).toContain('"catalogue_services"');
  });
});
