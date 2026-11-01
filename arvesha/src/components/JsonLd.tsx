import { jsonLdString } from '@/lib/seo';

/** Structured data for search engines. The content is escaped so it cannot close the script tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
