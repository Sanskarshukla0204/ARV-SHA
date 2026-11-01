import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site';

// The admin panel path is secret, so it is never listed here. Private areas are blocked from crawlers.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/cart', '/checkout', '/payment/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/onboarding'] }],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
