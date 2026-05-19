'use client';

import { useTranslations } from 'next-intl';

interface Props {
  viewerUrl: string;
  viewerName: string;
  investorName: string;
  investorEmail: string;
  onClose: () => void;
}

export function DocumentViewerModal({ viewerUrl, viewerName, investorName, investorEmail, onClose }: Props) {
  const t = useTranslations('portal.dealDetail');
  return (
    <div
      className="fixed inset-0 z-[100] flex items-stretch md:items-center justify-center bg-black/80 backdrop-blur-md md:p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white md:rounded-2xl overflow-hidden flex flex-col w-full h-full md:w-[85vw] md:h-[90vh] md:max-w-[1100px]"
        style={{ boxShadow: '0 40px 100px rgba(0,0,0,0.4)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 shrink-0 gap-3" style={{ background: 'linear-gradient(135deg, #0E3470, #0a2450)', borderBottom: '2px solid #BC9C45' }}>
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-[#BC9C45]/15 flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#BC9C45" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-white text-[13px] md:text-[14px] font-semibold truncate">{viewerName}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors border border-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 relative" style={{ background: '#1a1a2e' }}>
          <div className="absolute inset-0 pointer-events-none z-10" style={{
            background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.006) 2px, rgba(255,255,255,0.006) 4px)',
          }} />
          <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="absolute whitespace-nowrap select-none"
                style={{
                  top: `${i * 20}%`,
                  left: '50%',
                  transform: 'translateX(-50%) rotate(-22deg)',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: `rgba(188,156,69,${0.04 + (i % 2) * 0.02})`,
                  letterSpacing: '3px',
                  textTransform: 'uppercase',
                }}
              >
                CONFIDENTIAL · {investorName} · {investorEmail}
              </div>
            ))}
          </div>
          <iframe
            src={viewerUrl}
            className="w-full h-full border-0 relative z-0"
            title={viewerName}
          />
        </div>

        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-[#EEF0F4] shrink-0">
          <div className="text-[11px] text-[#9CA3AF]">
            {t('viewedBy')} <span className="font-semibold text-[#0E3470]">{investorName}</span> · {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}
