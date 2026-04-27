import { NDA_DISCLOSING_PARTY } from '@/lib/legal/nda-text';

interface NDASignatureBlockProps {
  date: string;
  receivingPartyName?: string;
  receivingPartyCompany?: string;
}

export default function NDASignatureBlock({
  date,
  receivingPartyName,
  receivingPartyCompany,
}: NDASignatureBlockProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-6 border-t border-[#E5E7EB]">
      {/* Disclosing party — fixed */}
      <div>
        <div className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] mb-2">
          Disclosing Party
        </div>
        <div className="text-[13px] font-semibold text-[#0E3470]">{NDA_DISCLOSING_PARTY.entity}</div>
        <div className="font-[family-name:var(--font-playfair)] text-[20px] italic text-[#0E3470] border-b border-[#0E3470]/20 mt-2 pb-1">
          {NDA_DISCLOSING_PARTY.signerName}
        </div>
        <div className="text-[12px] text-[#4B5563] mt-1">{NDA_DISCLOSING_PARTY.signerTitle}</div>
        <div className="text-[12px] text-[#6B7280] mt-1">{date}</div>
      </div>

      {/* Receiving party — auto-fills as user types */}
      <div>
        <div className="text-[10px] font-semibold text-[#9CA3AF] uppercase tracking-[1.5px] mb-2">
          Receiving Party
        </div>
        <div className="font-[family-name:var(--font-playfair)] text-[20px] italic text-[#0E3470] border-b border-[#0E3470]/20 pb-1 min-h-[28px]">
          {receivingPartyName?.trim() || (
            <span className="text-[#9CA3AF] not-italic font-sans text-[12px]">
              Your full legal name
            </span>
          )}
        </div>
        <div className="text-[12px] text-[#4B5563] mt-1 min-h-[18px]">
          {receivingPartyCompany?.trim() || (
            <span className="text-[#9CA3AF]">Company / Entity (optional)</span>
          )}
        </div>
        <div className="text-[12px] text-[#6B7280] mt-1">{date}</div>
      </div>
    </div>
  );
}
