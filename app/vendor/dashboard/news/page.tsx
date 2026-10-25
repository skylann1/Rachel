import { getNewsFeed } from '@/lib/news-actions';
import { NewsFeed } from '@/components/news/NewsFeed';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Berita & Pengumuman - RACHEL K3' };

export default async function NewsPage() {
  const items = await getNewsFeed();
  return <NewsFeed items={items} basePath="/vendor/dashboard/news" />;
}
