import { siteUrl } from './env';

export const SITE = {
  name: 'Arvésha Clothing',
  shortName: 'Arvésha',
  studio: 'Arvisha Digitals',
  studioUrl: 'https://www.instagram.com/arvisha.digitals',
  description:
    'Arvésha Clothing is an online clothing store. Browse by category, pick your size and colour, and pay securely online.',
  locale: 'en_IN',
  currency: 'INR',
  /** Used by the admin launch checklist and by SEO helpers. */
  keywords: ['Arvésha Clothing', 'online clothing store India', 'buy clothes online', 'fashion', 'clothing'],
} as const;

export function absoluteUrl(path = '/'): string {
  return `${siteUrl()}${path.startsWith('/') ? path : `/${path}`}`;
}

export interface NavLink {
  label: string;
  href: string;
}

// Footer labels are kept to one or two words on purpose.
export const FOOTER_PRIMARY: NavLink[] = [
  { label: 'Home', href: '/' },
  { label: 'Categories', href: '/categories' },
  { label: 'Account', href: '/account' },
  { label: 'My orders', href: '/account/orders' },
];

export const FOOTER_HELP: NavLink[] = [
  { label: 'Support', href: '/support' },
  { label: 'Help', href: '/help' },
];

export const FOOTER_LEGAL: NavLink[] = [
  { label: 'Privacy', href: '/legal/privacy-policy' },
  { label: 'Terms', href: '/legal/terms-of-service' },
  { label: 'Legal', href: '/legal' },
];

export interface LegalPageMeta {
  slug: string;
  title: string;
  summary: string;
  group: 'Your data' | 'Buying' | 'Using the store' | 'Security and trust';
}

/** The single legal hub at /legal. Every page below lives at /legal/<slug>. */
export const LEGAL_PAGES: LegalPageMeta[] = [
  { slug: 'privacy-policy', title: 'Privacy Policy', group: 'Your data', summary: 'What personal data we collect, why, how long we keep it and your rights over it.' },
  { slug: 'cookie-policy', title: 'Cookie Policy', group: 'Your data', summary: 'Which cookies and similar storage the store uses and what each one is for.' },
  { slug: 'cookie-preferences', title: 'Cookie Preferences', group: 'Your data', summary: 'Choose which optional cookies you allow. Change your choice at any time.' },
  { slug: 'data-processing-agreement', title: 'Data Processing Agreement', group: 'Your data', summary: 'How we and our service providers process personal data on your behalf.' },
  { slug: 'terms-of-service', title: 'Terms of Service', group: 'Buying', summary: 'The rules for using the store and placing orders.' },
  { slug: 'shipping-policy', title: 'Shipping Policy', group: 'Buying', summary: 'Where we deliver, how long it takes and what it costs.' },
  { slug: 'return-exchange-policy', title: 'Return and Exchange Policy', group: 'Buying', summary: 'How to return or exchange an item and which items are eligible.' },
  { slug: 'refund-policy', title: 'Refund Policy', group: 'Buying', summary: 'When refunds are issued, how they are paid and how long they take.' },
  { slug: 'cancellation-policy', title: 'Cancellation Policy', group: 'Buying', summary: 'When you can cancel an order and what happens to your payment.' },
  { slug: 'acceptable-use-policy', title: 'Acceptable Use Policy', group: 'Using the store', summary: 'What is not allowed when using the website or your account.' },
  { slug: 'community-guidelines', title: 'Community Guidelines', group: 'Using the store', summary: 'How we expect people to treat each other when they contact us or post content.' },
  { slug: 'disclaimer', title: 'Disclaimer', group: 'Using the store', summary: 'Limits on what we promise about product colours, sizing and website availability.' },
  { slug: 'accessibility-statement', title: 'Accessibility Statement', group: 'Using the store', summary: 'Our accessibility goals, known gaps and how to report a problem.' },
  { slug: 'security-policy', title: 'Security Policy', group: 'Security and trust', summary: 'The technical and organisational measures that protect your account and payments.' },
  { slug: 'responsible-disclosure', title: 'Responsible Disclosure', group: 'Security and trust', summary: 'How to report a security issue to us safely.' },
];

export const LEGAL_GROUPS: LegalPageMeta['group'][] = ['Your data', 'Buying', 'Using the store', 'Security and trust'];

export function legalMeta(slug: string): LegalPageMeta | undefined {
  return LEGAL_PAGES.find((p) => p.slug === slug);
}

/** Date shown on every legal page. Update it whenever the text changes. */
export const LEGAL_UPDATED = '2026-10-11';

export const SUPPORT_TOPICS = ['Order or delivery', 'Return or exchange', 'Refund or payment', 'Product or size', 'My account', 'Something else'] as const;
