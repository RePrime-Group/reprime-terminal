'use client';

import { useTranslations } from 'next-intl';
import type { DealWithDetails } from '@/lib/types/database';

interface Props {
  deal: DealWithDetails;
  previewMode?: boolean;
  expressingInterest: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ExpressInterestModal({ deal, previewMode, expressingInterest, onClose, onConfirm }: Props) {
  const t = useTranslations('portal.dealDetail');
  const tcom = useTranslations('common');
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4 p-8 animate-fade-up" style={{ animationDuration: '0.3s' }}>
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[#FDF8ED] flex items-center justify-center mb-4">
            <span className="text-2xl">&#x1F4BC;</span>
          </div>
          <h3 className="font-[family-name:var(--font-playfair)] text-[18px] font-semibold text-[#0E3470] mb-2">
            {t('expressInterestIn', { name: deal.name })}
          </h3>
          <p className="text-[13px] text-[#4B5563] mb-6">
            {t('expressInterestDesc')}
          </p>
          <div className="flex items-center gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 text-[13px] font-medium text-[#6B7280] hover:text-[#0E3470] transition-colors"
            >
              {tcom('cancel')}
            </button>
            <button
              onClick={onConfirm}
              disabled={expressingInterest || previewMode}
              title={previewMode ? 'Preview mode — read-only' : undefined}
              className="flex-1 py-2.5 bg-[#BC9C45] hover:bg-[#A88A3D] text-white text-[13px] font-semibold rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {expressingInterest && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {expressingInterest ? t('processing') : tcom('confirm')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
