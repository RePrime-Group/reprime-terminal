import RePrimeLogo from '@/components/RePrimeLogo';
import { TERMS_TITLE, TERMS_BODY } from '@/lib/legal/terms-text';

export default async function TermsPage({ params }: { params: Promise<{ locale: string }> }) {
  await params;
  const blocks = TERMS_BODY.split('\n\n');

  return (
    <div className="min-h-screen px-4 py-16" style={{ backgroundColor: '#07090F' }}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-4">
          <RePrimeLogo width={220} />
          <h1 className="text-2xl font-semibold text-white">{TERMS_TITLE}</h1>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8">
          <div className="flex flex-col gap-4 text-sm leading-relaxed text-white/60">
            {blocks.map((block, i) => {
              const [first, ...rest] = block.split('\n');
              const isHeading = /^\d+\.\s/.test(first);
              if (isHeading) {
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <h2 className="text-white/90 font-medium">{first}</h2>
                    {rest.length > 0 && <p>{rest.join(' ')}</p>}
                  </div>
                );
              }
              return <p key={i}>{block}</p>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
