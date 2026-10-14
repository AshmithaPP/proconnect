import { Poppins } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
});

export const metadata = {
  title: 'Sales Strategy Consultant — Build a Sales Process That Drives Business Growth',
  description:
    'Helping companies strengthen their sales strategy, improve lead conversion, and build a more structured sales process with 10+ years of sales experience.',
  openGraph: {
    title: 'Sales Strategy Consultant — Build a Sales Process That Drives Business Growth',
    description:
      'Helping companies strengthen their sales strategy, improve lead conversion, and build a more structured sales process with 10+ years of sales experience.',
    type: 'website',
    locale: 'en_US',
    siteName: 'ProConnect',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sales Strategy Consultant — Build a Sales Process That Drives Business Growth',
    description:
      'Helping companies strengthen their sales strategy, improve lead conversion, and build a more structured sales process with 10+ years of sales experience.',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body style={{ fontFamily: 'var(--font-poppins), sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
