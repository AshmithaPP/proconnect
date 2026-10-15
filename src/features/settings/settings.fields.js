/**
 * Form layout for the General and SEO settings pages (client-safe).
 * SMTP has its own form (password handling + test email).
 */

// Fixed list (not Intl.supportedValuesOf) so server and browser render identical options
const TIMEZONE_OPTIONS = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'Asia/Jakarta', 'Asia/Bangkok',
  'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo', 'Asia/Riyadh', 'Asia/Karachi', 'Asia/Dhaka', 'Asia/Colombo',
  'Asia/Kathmandu', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Europe/Amsterdam', 'Africa/Johannesburg',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Toronto',
  'America/Sao_Paulo', 'Australia/Sydney', 'Australia/Perth', 'Pacific/Auckland', 'UTC',
].map((zone) => ({ value: zone, label: zone }));

export const SETTINGS_FORMS = {
  general: {
    title: 'General',
    subtitle: 'Business details used across the website and in emails.',
    fields: [
      { name: 'siteName', label: 'Site name', required: true, hint: 'Shown in the browser tab, emails and the site header.' },
      { name: 'timezone', label: 'Business timezone', type: 'select', options: TIMEZONE_OPTIONS, hint: 'Used for booking dates and times.' },
      { name: 'contactEmail', label: 'Contact email', type: 'email', placeholder: 'hello@yourdomain.com' },
      { name: 'contactPhone', label: 'Contact phone', placeholder: '+91 90000 00000' },
      { name: 'businessAddress', label: 'Business address', type: 'textarea', wide: true },
      { name: 'logoUrl', label: 'Logo URL', type: 'url', wide: true, placeholder: 'https://…/logo.png' },
    ],
  },
  seo: {
    title: 'SEO',
    subtitle: 'How the website appears in Google and when shared on social media. Changes apply immediately.',
    fields: [
      { name: 'metaTitle', label: 'Meta title', required: true, wide: true, hint: 'Ideally 50–60 characters.' },
      { name: 'metaDescription', label: 'Meta description', type: 'textarea', required: true, wide: true, hint: 'Ideally 140–160 characters.' },
      { name: 'keywords', label: 'Keywords', wide: true, placeholder: 'sales consultant, sales strategy, lead conversion', hint: 'Comma separated.' },
      { name: 'canonicalUrl', label: 'Site URL (canonical)', type: 'url', placeholder: 'https://www.yourdomain.com', hint: 'Used for canonical links and the sitemap.' },
      { name: 'ogImageUrl', label: 'Social share image URL', type: 'url', placeholder: 'https://…/og-image.jpg', hint: '1200×630 recommended.' },
      { name: 'googleAnalyticsId', label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX', hint: 'Leave empty to disable analytics.' },
      { name: 'allowIndexing', label: 'Allow search engines to index the site', type: 'checkbox', hint: 'Turn off for staging/test sites.' },
    ],
  },
};
