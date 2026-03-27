'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface OnboardingOverlayProps {
  firstName: string;
  userId: string;
}

interface TourStep {
  target: string; // data-tour attribute value
  title: string;
  description: string;
  position: 'bottom' | 'top' | 'left' | 'right';
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'nav-tabs',
    title: 'Navigation',
    description: 'Switch between your Dashboard, Portfolio tracker, and Deal Compare tool.',
    position: 'bottom',
  },
  {
    target: 'hero-metrics',
    title: 'Portfolio Overview',
    description: 'Key metrics across all active opportunities — deal volume, equity, IRR, and more.',
    position: 'bottom',
  },
  {
    target: 'first-deal',
    title: 'Deal Cards',
    description: 'Each card shows key metrics at a glance. Click any card to view full details, financials, and the data room.',
    position: 'right',
  },
  {
    target: 'market-sidebar',
    title: 'Market Intelligence',
    description: 'Track the CRE market cycle, maturity wall, and live terminal activity in the sidebar.',
    position: 'left',
  },
  {
    target: 'notif-bell',
    title: 'Notifications',
    description: 'Stay informed — deal updates, new documents, and meeting confirmations appear here.',
    position: 'bottom',
  },
];

type Stage = 'welcome' | 'tour' | null;

export default function OnboardingOverlay({ firstName, userId }: OnboardingOverlayProps) {
  const [stage, setStage] = useState<Stage>(null);
  const [dismissed, setDismissed] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [spotlight, setSpotlight] = useState<DOMRect | null>(null);

  useEffect(() => {
    const localKey = `rp_onboarding_${userId}`;
    const localVisit = parseInt(localStorage.getItem(localKey) ?? '0');

    if (localVisit >= 1) {
      setDismissed(true);
      return;
    }

    setStage('welcome');

    const supabase = createClient();
    supabase.from('terminal_activity_log').insert({
      user_id: userId,
      action: 'portal_viewed',
      metadata: { visit_number: 1 },
    });
  }, [userId]);

  const updateSpotlight = useCallback(() => {
    if (stage !== 'tour') return;
    const step = TOUR_STEPS[tourStep];
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      setSpotlight(el.getBoundingClientRect());
      // Scroll element into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      setSpotlight(null);
    }
  }, [stage, tourStep]);

  useEffect(() => {
    updateSpotlight();
    window.addEventListener('resize', updateSpotlight);
    window.addEventListener('scroll', updateSpotlight, true);
    return () => {
      window.removeEventListener('resize', updateSpotlight);
      window.removeEventListener('scroll', updateSpotlight, true);
    };
  }, [updateSpotlight]);

  const handleStartTour = () => {
    setStage('tour');
    setTourStep(0);
  };

  const handleNext = () => {
    if (tourStep < TOUR_STEPS.length - 1) {
      setTourStep(tourStep + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = () => {
    const localKey = `rp_onboarding_${userId}`;
    localStorage.setItem(localKey, '1');
    setDismissed(true);
  };

  if (dismissed || !stage) return null;

  // Welcome screen
  if (stage === 'welcome') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(7,9,15,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[520px] text-center animate-fade-up" style={{ animationDuration: '0.5s' }}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#BC9C45] to-[#D4B96A] mx-auto mb-6 flex items-center justify-center shadow-[0_8px_32px_rgba(188,156,69,0.3)]">
            <span className="text-white text-[28px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
          </div>

          <h1 className="font-[family-name:var(--font-playfair)] text-[32px] font-semibold text-white mb-3">
            Welcome to RePrime Terminal, {firstName}.
          </h1>
          <p className="text-[15px] text-white/50 leading-relaxed mb-2">
            You now have access to institutional-grade commercial real estate opportunities.
          </p>
          <p className="text-[13px] text-white/30 mb-8">
            Take a quick tour — it only takes 30 seconds.
          </p>

          <button
            onClick={handleStartTour}
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[15px] font-bold shadow-[0_8px_32px_rgba(188,156,69,0.3)] hover:shadow-[0_12px_40px_rgba(188,156,69,0.4)] transition-all hover:-translate-y-0.5"
          >
            Let&apos;s Start →
          </button>

          <button
            onClick={handleFinish}
            className="block mx-auto mt-4 text-[11px] text-white/20 hover:text-white/40 transition-colors"
          >
            Skip
          </button>
        </div>
      </div>
    );
  }

  // Tour mode — spotlight + tooltip
  const step = TOUR_STEPS[tourStep];
  const pad = 8;
  const isLast = tourStep === TOUR_STEPS.length - 1;

  // Tooltip positioning
  const getTooltipStyle = (): React.CSSProperties => {
    if (!spotlight) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const gap = 16;
    const style: React.CSSProperties = { position: 'fixed' };

    switch (step.position) {
      case 'bottom':
        style.top = spotlight.bottom + gap;
        style.left = spotlight.left + spotlight.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'top':
        style.bottom = window.innerHeight - spotlight.top + gap;
        style.left = spotlight.left + spotlight.width / 2;
        style.transform = 'translateX(-50%)';
        break;
      case 'left':
        style.top = spotlight.top + spotlight.height / 2;
        style.right = window.innerWidth - spotlight.left + gap;
        style.transform = 'translateY(-50%)';
        break;
      case 'right':
        style.top = spotlight.top + spotlight.height / 2;
        style.left = spotlight.right + gap;
        style.transform = 'translateY(-50%)';
        break;
    }

    return style;
  };

  return (
    <>
      {/* Dark overlay with spotlight cutout via clip-path */}
      <div
        className="fixed inset-0 z-[200] transition-all duration-300"
        style={{
          background: 'rgba(7,9,15,0.75)',
          clipPath: spotlight
            ? `polygon(
                0% 0%, 0% 100%, 100% 100%, 100% 0%, 0% 0%,
                ${spotlight.left - pad}px ${spotlight.top - pad}px,
                ${spotlight.left - pad}px ${spotlight.bottom + pad}px,
                ${spotlight.right + pad}px ${spotlight.bottom + pad}px,
                ${spotlight.right + pad}px ${spotlight.top - pad}px,
                ${spotlight.left - pad}px ${spotlight.top - pad}px
              )`
            : undefined,
        }}
        onClick={handleNext}
      />

      {/* Spotlight border glow */}
      {spotlight && (
        <div
          className="fixed z-[201] pointer-events-none rounded-xl transition-all duration-300"
          style={{
            top: spotlight.top - pad,
            left: spotlight.left - pad,
            width: spotlight.width + pad * 2,
            height: spotlight.height + pad * 2,
            boxShadow: '0 0 0 2px rgba(188,156,69,0.5), 0 0 24px rgba(188,156,69,0.15)',
          }}
        />
      )}

      {/* Tooltip */}
      <div
        className="fixed z-[202] w-[320px] animate-fade-up"
        style={{ ...getTooltipStyle(), animationDuration: '0.3s' }}
      >
        <div className="bg-[#0F1419] rounded-xl p-5 shadow-2xl border border-white/[0.08]">
          {/* Step counter */}
          <div className="flex items-center gap-1.5 mb-3">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === tourStep ? 'w-5 bg-[#BC9C45]' : i < tourStep ? 'w-2 bg-[#BC9C45]/50' : 'w-2 bg-white/10'
                }`}
              />
            ))}
            <span className="ml-auto text-[10px] text-white/25">{tourStep + 1}/{TOUR_STEPS.length}</span>
          </div>

          <h3 className="text-[15px] font-semibold text-white mb-1.5">{step.title}</h3>
          <p className="text-[13px] text-white/50 leading-relaxed mb-4">{step.description}</p>

          <div className="flex items-center justify-between">
            <button
              onClick={handleFinish}
              className="text-[11px] text-white/25 hover:text-white/50 transition-colors"
            >
              Skip tour
            </button>
            <button
              onClick={handleNext}
              className="px-5 py-2 rounded-lg bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[12px] font-bold hover:opacity-90 transition-opacity"
            >
              {isLast ? 'Done' : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
