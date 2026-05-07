'use client';

import { useTranslations } from 'next-intl';

interface Props {
  onPick: (prompt: string) => void;
  dealName: string | null;
}

export default function SuggestedPrompts({ onPick, dealName }: Props) {
  const t = useTranslations('ai');
  const prompts: Array<'prompt1' | 'prompt2' | 'prompt3' | 'prompt4'> = [
    'prompt1',
    'prompt2',
    'prompt3',
    'prompt4',
  ];

  return (
    <div className="px-4 py-5 space-y-4">
      <p className="text-[12.5px] text-white/65 leading-relaxed">
        {t('emptyGreeting', { deal: dealName ?? '—' })}
      </p>
      <div>
        <div className="text-[9.5px] font-semibold tracking-[1.5px] uppercase text-white/35 mb-2">
          {t('suggestedPrompts')}
        </div>
        <div className="space-y-1.5">
          {prompts.map((key, i) => {
            const text = t(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPick(text)}
                style={{ animationDelay: `${i * 60}ms` }}
                className="animate-rp-msg-in opacity-0 w-full text-start text-[12px] text-white/85 px-3.5 py-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-[#BC9C45]/30 hover:text-white hover:translate-x-[2px] active:translate-x-0 cursor-pointer transition-all duration-200"
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
