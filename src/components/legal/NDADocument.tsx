import { NDA_TITLE, getNDABody } from '@/lib/legal/nda-text';

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
    <div className={`text-[12px] text-[#4B5563] leading-relaxed ${className}`}>
      {showTitle && (
        <h2 className="text-[14px] font-bold text-[#0E3470] tracking-[0.5px] text-center mb-5">
          {NDA_TITLE}
        </h2>
      )}
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p}</p>
        ))}
      </div>
    </div>
  );
}
