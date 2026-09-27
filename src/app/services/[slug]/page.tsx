import { permanentRedirect } from "next/navigation";

export default async function LegacyServiceDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  permanentRedirect(`/services/repairs-maintenance/${slug}`);
}
