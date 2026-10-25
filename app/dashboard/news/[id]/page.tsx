import { notFound } from 'next/navigation';
import { getNewsItem } from '@/lib/news-actions';
import { NewsArticleView } from '@/components/news/NewsArticleView';

export const dynamic = 'force-dynamic';

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getNewsItem(id);
  if (!item) notFound();
  return <NewsArticleView item={item} basePath="/dashboard/news" />;
}
