import { ChevronDown } from "lucide-react";
import { serviceCatalogue } from "@/config/service-catalogue";
import { Container, Eyebrow } from "@/components/ui/container";
import { listServiceCatalogue } from "@/lib/service-catalogue/repository";

export async function PublicServiceCatalogue() {
  const storedCatalogue = await listServiceCatalogue();
  const catalogue = storedCatalogue.length ? storedCatalogue.map((system) => ({ id: system.key, name: system.name, description: system.description, services: system.services.map((service) => service.name) })) : serviceCatalogue;
  return <section className="bg-[#F4F7FA] py-20 sm:py-24" aria-labelledby="full-service-catalogue">
    <Container>
      <Eyebrow>Full service catalogue</Eyebrow>
      <div className="mt-3 grid gap-5 lg:grid-cols-[.8fr_1.2fr] lg:items-end">
        <h2 id="full-service-catalogue" className="text-4xl font-extrabold text-[#071127] sm:text-5xl">Explore services by vehicle system.</h2>
        <p className="max-w-2xl leading-7 text-[#586575]">Open a system to see the diagnostic, repair and maintenance work available. If you are unsure which service fits, describe the symptoms when requesting a quote.</p>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        {catalogue.map((category) => <details key={category.id} className="group overflow-hidden rounded-2xl border border-[#DCE6F2] bg-white open:border-[#071127] open:shadow-lg">
          <summary className="flex min-h-20 cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 transition-colors group-open:bg-[#071127] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1974E2] sm:px-6">
            <span><span className="block text-lg font-extrabold text-[#071127] group-open:text-white">{category.name}</span><span className="mt-1 block text-sm text-[#667586] group-open:text-[#B7C5D7]">{category.services.length} services</span></span>
            <ChevronDown aria-hidden="true" className="shrink-0 text-[#1974E2] transition group-open:rotate-180 group-open:text-[#67B9FF]" size={20} />
          </summary>
          <div className="border-t border-[#E4EAF0] px-5 py-5 sm:px-6">
            <p className="text-sm leading-6 text-[#586575]">{category.description}</p>
            <ul className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {category.services.map((service) => <li key={service} className="flex gap-2 text-sm font-semibold leading-5 text-[#263446]"><span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-[#1974E2]" />{service}</li>)}
            </ul>
          </div>
        </details>)}
      </div>
    </Container>
  </section>;
}
