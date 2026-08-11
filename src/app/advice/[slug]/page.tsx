import { permanentRedirect } from "next/navigation";

export default async function AdviceArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  permanentRedirect(`/news/${(await params).slug}`);
}
