import { Fragment } from 'react';
import { NDA_TITLE, NDA_RECEIVING_PARTY_PLACEHOLDER, getNDABody } from '@/lib/legal/nda-text';

interface NDADocumentProps {
  date: string;
  receivingPartyName?: string;
  /** Show the centered title heading. Default true. */
  showTitle?: boolean;
  className?: string;
}

export default function NDADocument({
  date,
  receivingPartyName,
  showTitle = true,
  className = '',
}: NDADocumentProps) {
  const paragraphs = getNDABody({ date, receivingPartyName }).split(/\n\n+/);

  return (
    <div className={`text-[#4B5563] ${className}`}>
      {showTitle && (
        <h2 className="text-[15px] font-bold text-[#0E3470] tracking-[0.5px] text-center mb-6">
          {NDA_TITLE}
        </h2>
      )}
      <div className="space-y-4 text-[13px] leading-[1.75] max-w-[65ch]">
        {paragraphs.map((p, i) => {
          // Render the empty-state name placeholder as a greyed field hint so it
          // doesn't read like an unfilled merge field in a finished contract.
          if (p.includes(NDA_RECEIVING_PARTY_PLACEHOLDER)) {
            const parts = p.split(NDA_RECEIVING_PARTY_PLACEHOLDER);
            return (
              <p key={i} className="whitespace-pre-line">
                {parts.map((part, j) => (
                  <Fragment key={j}>
                    {part}
                    {j < parts.length - 1 && (
                      <span className="italic text-[#9CA3AF]">your full legal name</span>
                    )}
                  </Fragment>
                ))}
              </p>
            );
          }
          // Numbered clause — emphasize the "N. Heading." lead-in for scannability.
          const clause = p.match(/^(\d+\.\s+[^.]+\.)\s*([\s\S]*)$/);
          if (clause) {
            return (
              <p key={i} className="whitespace-pre-line">
                <span className="font-semibold text-[#0E3470]">{clause[1]}</span> {clause[2]}
              </p>
            );
          }
          return <p key={i} className="whitespace-pre-line">{p}</p>;
        })}
      </div>
    </div>
  );
}
