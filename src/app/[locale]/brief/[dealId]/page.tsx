'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import SellerBrief from '@/components/SellerBrief';

// ─────────────────────────────────────────────────────────────────────────────
// Printable seller brief — opens in a new tab from the admin deal page.
// Lives outside the (admin) route group so it inherits only the bare locale
// layout (no admin sidebar/nav). The page itself enforces auth: only owners
// and employees can view a brief; everyone else is bounced to login.
//
// PDF export: uses the browser's native print-to-PDF (e.g., Microsoft Print
// to PDF, Save as PDF in Chrome). The trick that avoids the brief getting
// chopped onto multiple letter pages: at print time we measure the brief's
// rendered dimensions and inject a `@page { size: <w>in <h>in }` rule, so
// the print engine treats the whole brief as one tall page in portrait
// orientation.
// ─────────────────────────────────────────────────────────────────────────────

interface BriefData {
  deal: Record<string, unknown> & { name?: string };
  addresses: Record<string, unknown>[];
  tenants: Record<string, unknown>[];
  capexItems: Record<string, unknown>[];
  aiTalkingPoints: Record<string, unknown> | null;
}

const PRINT_STYLE_ID = 'seller-brief-print-style';

// Strip characters Windows / macOS forbid in filenames, and any unicode
// punctuation that some print drivers don't handle (em-dash → hyphen).
function sanitizeForFilename(name: string): string {
  return name
    .replace(/[–—]/g, '-') // en/em-dashes → hyphen
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Seller Brief';
}

export default function SellerBriefPage() {
  const params = useParams<{ locale: string; dealId: string }>();
  const router = useRouter();
  const locale = params.locale;
  const dealId = params.dealId;

  const [authState, setAuthState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [data, setData] = useState<BriefData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const briefRef = useRef<HTMLDivElement | null>(null);

  // Auth check — must be owner or employee.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) router.replace(`/${locale}/login`);
        return;
      }
      const { data: profile } = await supabase
        .from('terminal_users')
        .select('role')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      if (!profile || !['owner', 'employee'].includes(profile.role as string)) {
        setAuthState('denied');
        return;
      }
      setAuthState('allowed');
    })();
    return () => {
      cancelled = true;
    };
  }, [locale, router]);

  // Fetch brief data once authorised.
  useEffect(() => {
    if (authState !== 'allowed' || !dealId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/seller-brief', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId }),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json?.error ?? 'Failed to generate brief');
        }
        if (!cancelled) setData(json as BriefData);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to generate brief');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authState, dealId]);

  // Set the document title once the deal name is known. The print dialog
  // suggests its Save As filename from document.title, so we keep this
  // ASCII-only and free of characters Windows can't use in filenames
  // (\ / : * ? " < > |). Using a regular hyphen instead of an em-dash
  // because some Windows print drivers (incl. Microsoft Print to PDF) drop
  // the title silently when they hit unexpected unicode.
  useEffect(() => {
    if (data?.deal?.name) {
      document.title = `${sanitizeForFilename(data.deal.name)} - Seller Brief`;
    }
  }, [data?.deal?.name]);

  // Pre-load Atkinson Hyperlegible + Cormorant Garamond at the document level
  // so they're cached and ready before the print dialog opens.
  useEffect(() => {
    const FONT_HREF =
      'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Cormorant+Garamond:wght@500;600;700&display=swap';
    if (typeof document === 'undefined') return;
    if (document.querySelector(`link[data-seller-brief-fonts]`)) return;
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);
    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    link.setAttribute('data-seller-brief-fonts', 'true');
    document.head.appendChild(link);
  }, []);

  const handleDownloadPdf = async () => {
    const el = briefRef.current;
    if (!el || preparing) return;
    setPreparing(true);
    try {
      // Wait for fonts so layout measurements line up with what'll print.
      if (typeof document !== 'undefined' && document.fonts) {
        await document.fonts.ready;
        await Promise.all([
          document.fonts.load("400 14px 'Atkinson Hyperlegible'"),
          document.fonts.load("700 14px 'Atkinson Hyperlegible'"),
          document.fonts.load("italic 400 14px 'Atkinson Hyperlegible'"),
          document.fonts.load("700 24px 'Cormorant Garamond'"),
          document.fonts.load("700 42px 'Cormorant Garamond'"),
        ]).catch(() => {
          // If fonts can't load, proceed — system fallback is acceptable.
        });
      }

      // Measure the brief's actual rendered dimensions. We size the print
      // page to match exactly so nothing gets chopped across pages.
      // SellerBrief's outer div has min-height: 100vh, which would otherwise
      // pad the page with empty black space below short briefs — we strip
      // it via the print-only CSS injected below.
      const widthPx = el.offsetWidth || el.scrollWidth;
      const briefRoot = el.firstElementChild as HTMLElement | null;
      const briefContent = briefRoot?.firstElementChild as HTMLElement | null;
      const heightPx =
        briefContent?.offsetHeight || briefRoot?.scrollHeight || el.scrollHeight;

      // 96 CSS px per inch is the standard the print engine uses for
      // converting between pixel layout and physical page sizes.
      const widthIn = widthPx / 96;
      const heightIn = heightPx / 96;

      // Build (or replace) the print-only stylesheet:
      //   - Custom @page size = brief size → single tall portrait page,
      //     no pagination splits.
      //   - Hide everything except the brief wrapper during print.
      //   - Hide the floating download button.
      //   - Strip the SellerBrief outer's min-height so a short brief
      //     doesn't add empty space at the bottom of the page.
      const previous = document.getElementById(PRINT_STYLE_ID);
      if (previous) previous.remove();
      const styleEl = document.createElement('style');
      styleEl.id = PRINT_STYLE_ID;
      styleEl.textContent = `
        @media print {
          @page {
            size: ${widthIn.toFixed(3)}in ${heightIn.toFixed(3)}in;
            margin: 0;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #07090E !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          [data-seller-brief-print-hide] { display: none !important; }
          [data-seller-brief-export],
          [data-seller-brief-export] > div {
            min-height: 0 !important;
            height: auto !important;
          }
        }
      `;
      document.head.appendChild(styleEl);

      // Clean up the injected print stylesheet after the dialog closes,
      // so on-screen behaviour and any later Ctrl+P aren't affected.
      const cleanup = () => {
        const s = document.getElementById(PRINT_STYLE_ID);
        if (s) s.remove();
        window.removeEventListener('afterprint', cleanup);
        setPreparing(false);
      };
      window.addEventListener('afterprint', cleanup);

      // Belt-and-suspenders: re-assert document.title immediately before
      // window.print() so the Save As dialog suggests the right filename
      // even if the user clicked before the title-setting useEffect ran.
      const briefTitle = `${sanitizeForFilename(data?.deal?.name ?? 'Seller Brief')} - Seller Brief`;
      document.title = briefTitle;

      // Some browsers fire `afterprint` synchronously, others delay it.
      // Allow a short tick for the @page rule and title to settle before
      // opening the dialog.
      requestAnimationFrame(() => {
        window.print();
      });
    } catch (err) {
      console.error('Print preparation failed:', err);
      setError(err instanceof Error ? err.message : 'Print preparation failed');
      setPreparing(false);
    }
  };

  if (authState === 'checking') {
    return <FullScreen message="Verifying access…" />;
  }
  if (authState === 'denied') {
    return <FullScreen message="You don't have permission to view this brief." tone="error" />;
  }
  if (error) {
    return <FullScreen message={error} tone="error" />;
  }
  if (!data) {
    return <FullScreen message="Generating seller brief…" />;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleDownloadPdf}
        disabled={preparing}
        data-seller-brief-print-hide
        style={{
          position: 'fixed',
          top: '16px',
          right: '16px',
          zIndex: 50,
          backgroundColor: '#E8D4A8',
          color: '#0D1117',
          fontWeight: 700,
          fontSize: '13px',
          letterSpacing: '0.5px',
          padding: '10px 18px',
          border: 'none',
          borderRadius: '6px',
          cursor: preparing ? 'wait' : 'pointer',
          opacity: preparing ? 0.7 : 1,
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          fontFamily: "'Atkinson Hyperlegible', 'Verdana', sans-serif",
        }}
      >
        {preparing ? 'Preparing…' : '↓ Download PDF'}
      </button>
      <div ref={briefRef} data-seller-brief-export>
        <SellerBrief
          deal={data.deal}
          tenants={data.tenants}
          capexItems={data.capexItems}
          addresses={data.addresses}
          aiTalkingPoints={data.aiTalkingPoints}
        />
      </div>
    </>
  );
}

function FullScreen({ message, tone }: { message: string; tone?: 'error' }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#07090E',
        color: tone === 'error' ? '#F85149' : '#E8ECF4',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Atkinson Hyperlegible', 'Verdana', sans-serif",
        fontSize: '18px',
        padding: '24px',
        textAlign: 'center',
      }}
    >
      {message}
    </div>
  );
}
