import { notFound } from 'next/navigation';

// Send unmatched /[locale]/... URLs to the localized [locale]/not-found.tsx
// instead of the locale-less root one.
export default function CatchAll() {
  notFound();
}
