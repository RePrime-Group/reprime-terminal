'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';

interface ErrorPageProps {
  error: Error;
  reset: () => void;
}

export default function AdminErrorPage({ error: _error, reset }: ErrorPageProps) {
  const params = useParams<{ locale: string }>();
  const locale = params.locale ?? 'en';

  return (
    <div className="min-h-screen bg-rp-page-bg flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 bg-gradient-to-br from-rp-gold to-rp-gold-soft rounded-lg flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-2xl font-[family-name:var(--font-playfair)] font-extrabold">
            R
          </span>
        </div>

        <h1 className="text-[24px] font-bold text-rp-navy mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-rp-gray-500 mb-8">
          An unexpected error occurred. Please try again.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href={`/${locale}/admin/deals`}
            className="inline-flex items-center px-6 py-3 bg-rp-navy text-white rounded-lg font-semibold text-sm hover:bg-rp-navy/90 transition-all duration-200"
          >
            Return to Deals
          </Link>
          <button
            onClick={reset}
            type="button"
            className="inline-flex items-center px-6 py-3 border border-rp-gray-300 text-rp-navy rounded-lg font-semibold text-sm hover:bg-rp-gray-100 transition-all duration-200"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
