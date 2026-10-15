import { getPublicSetting } from '@/features/settings/settings.repository';

/** /robots.txt — follows Settings → SEO → "Allow search engines"; portals are never indexed */
export default async function robots() {
  const seo = await getPublicSetting('seo');
  const siteUrl = seo.canonicalUrl || process.env.NEXT_PUBLIC_APP_URL;

  return {
    rules: seo.allowIndexing
      ? { userAgent: '*', allow: '/', disallow: ['/admin', '/consultant', '/api', '/payment-status'] }
      : { userAgent: '*', disallow: '/' },
    sitemap: seo.allowIndexing && siteUrl ? `${siteUrl.replace(/\/+$/, '')}/sitemap.xml` : undefined,
  };
}
