'use client';

import { useTranslations } from 'next-intl';
import { useCountdown } from '@/lib/hooks/useCountdown';

export function CountdownRing({
  label,
  targetDate,
  accentColor,
}: {
  label: string;
  targetDate: string | null;
  accentColor: string;
}) {
  const { days, hours, minutes, seconds, isExpired, isUrgent } =
    useCountdown(targetDate);
  const t = useTranslations('portal.dealDetail');

  const size = 150;
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const maxDays = 90;
  const totalSeconds = days * 86400 + hours * 3600 + minutes * 60 + seconds;
  const maxSeconds = maxDays * 86400;
  const progress = isExpired ? 0 : Math.min(totalSeconds / maxSeconds, 1);
  const dashOffset = circumference * (1 - progress);

  const ringColor = isUrgent && !isExpired ? '#DC2626' : isExpired ? '#D1D5DB' : accentColor;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#EEF0F4"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-[52px] font-[800] leading-none tracking-tight tabular-nums"
            style={{ color: ringColor }}
          >
            {isExpired ? '00' : days}
          </span>
          <span className="text-[10px] font-[700] uppercase tracking-[2px] text-[#6B7280] mt-1">
            {t('daysUpper')}
          </span>
          <span className="text-[12px] text-[#9CA3AF] mt-1 font-mono tabular-nums">
            {hh}:{mm}:{ss}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3">
        {isUrgent && !isExpired && (
          <div className="w-2 h-2 rounded-full bg-[#DC2626] countdown-pulse" />
        )}
        {isExpired && (
          <div className="w-2 h-2 rounded-full bg-[#D1D5DB]" />
        )}
        <span className="text-[12px] uppercase font-[700] tracking-[2px] text-[#0E3470]">
          {label}
        </span>
      </div>
      {isUrgent && !isExpired && (
        <span className="bg-[#DC2626] text-white text-[9px] px-2 py-0.5 rounded-full font-semibold mt-1.5">
          {t('urgent')}
        </span>
      )}
    </div>
  );
}
