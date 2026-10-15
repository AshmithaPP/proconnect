import { getPublicSetting } from '@/features/settings/settings.repository';

/** /sitemap.xml — the public landing page, on the canonical URL from Settings → SEO */
export default async function sitemap() {
  const seo = await getPublicSetting('seo');
  const siteUrl = (seo.canonicalUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');

  return [{ url: `${siteUrl}/`, changeFrequency: 'weekly', priority: 1 }];
}
