'use client';

import { useTranslations } from 'next-intl';

interface TerminalScoreProps {
  score: number;
  compact?: boolean;
}

export default function TerminalScore({ score, compact = false }: TerminalScoreProps) {
  const t = useTranslations('portal.terminalScore');
  const ringColor = score >= 90 ? '#0B8A4D' : score >= 70 ? '#BC9C45' : '#DC2626';
  const size = compact ? 56 : 80;
  const strokeWidth = compact ? 4 : 5;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  const subScores = [
    { width: score >= 80 ? 28 : score >= 60 ? 20 : 12, color: '#0B8A4D' },
    { width: score >= 75 ? 28 : score >= 55 ? 20 : 12, color: '#0B8A4D' },
    { width: score >= 70 ? 28 : score >= 50 ? 20 : 12, color: '#BC9C45' },
    { width: score >= 65 ? 28 : score >= 45 ? 20 : 12, color: '#BC9C45' },
    { width: score >= 60 ? 28 : score >= 40 ? 20 : 12, color: '#9CA3AF' },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-2 shrink-0">
        <svg width={size} height={size} className="shrink-0">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#EEF0F4"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text
            x={size / 2}
            y={size / 2 + 1}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#0E3470"
            fontSize="16"
            fontWeight="800"
            fontFamily="var(--font-poppins)"
          >
            {score}
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 shrink-0">
      <svg width={size} height={size} className="shrink-0">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#EEF0F4"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x={size / 2}
          y={size / 2 + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#0E3470"
          fontSize="22"
          fontWeight="800"
          fontFamily="var(--font-poppins)"
        >
          {score}
        </text>
      </svg>
      <div className="flex flex-col gap-1">
        <span className="text-[11px] font-bold text-[#0E3470] uppercase tracking-[1px]">
          {t('label')}
        </span>
        <span className="text-[10px] text-[#9CA3AF]">{t('subtitle')}</span>
        <div className="flex gap-0.5 mt-0.5">
          {subScores.map((bar, i) => (
            <div
              key={i}
              className="h-1 rounded-full"
              style={{ width: bar.width, backgroundColor: bar.color }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
