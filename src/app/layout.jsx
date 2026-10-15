import Script from 'next/script';
import { Poppins } from 'next/font/google';
import { getPublicSetting } from '@/features/settings/settings.repository';
import './globals.css';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

/** Site-wide metadata from the admin SEO + General settings (cached, refreshed on save) */
export async function generateMetadata() {
  const [seo, general] = await Promise.all([getPublicSetting('seo'), getPublicSetting('general')]);
  const siteUrl = seo.canonicalUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const images = seo.ogImageUrl ? [{ url: seo.ogImageUrl, width: 1200, height: 630 }] : undefined;

  return {
    metadataBase: new URL(siteUrl),
    title: seo.metaTitle,
    description: seo.metaDescription,
    keywords: seo.keywords ? seo.keywords.split(',').map((k) => k.trim()).filter(Boolean) : undefined,
    alternates: seo.canonicalUrl ? { canonical: '/' } : undefined,
    robots: seo.allowIndexing ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: seo.metaTitle,
      description: seo.metaDescription,
      type: 'website',
      locale: 'en_US',
      siteName: general.siteName,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo.metaTitle,
      description: seo.metaDescription,
      images: seo.ogImageUrl ? [seo.ogImageUrl] : undefined,
    },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }) {
  const seo = await getPublicSetting('seo');
  // Validated as G-XXXX / UA-XXXX-X when saved, so it is safe to place in the script
  const analyticsId = seo.googleAnalyticsId;

  return (
    <html lang="en" className={poppins.variable} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body style={{ fontFamily: 'var(--font-poppins), sans-serif' }} suppressHydrationWarning>
        {children}
        {analyticsId && (
          <>
            <Script src={`https://www.googletagmanager.com/gtag/js?id=${analyticsId}`} strategy="afterInteractive" />
            <Script id="google-analytics" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${analyticsId}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
