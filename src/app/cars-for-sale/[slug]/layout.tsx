export default function VehicleDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="vehicle-detail-page [&>section:first-of-type]:sticky [&>section:first-of-type]:top-[4.5rem] [&>section:first-of-type]:z-30 [&>section:first-of-type]:!py-3 [&>section:first-of-type]:shadow-xl [&>section:first-of-type_h1]:!text-3xl [&>section:first-of-type_h1]:!leading-none [&>section:first-of-type_p]:!mt-1 [&>section:first-of-type_p]:!text-sm [&>section:first-of-type_strong]:!text-2xl xl:[&>section:first-of-type]:top-20 xl:[&>section:first-of-type_h1]:!text-4xl">
      {children}
    </div>
  );
}
