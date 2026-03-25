'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface OnboardingOverlayProps {
  firstName: string;
  userId: string;
}

type OnboardingStage = 'welcome' | 'explore' | 'complete' | null;

export default function OnboardingOverlay({ firstName, userId }: OnboardingOverlayProps) {
  const [stage, setStage] = useState<OnboardingStage>(null);
  const [visitNumber, setVisitNumber] = useState<number>(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check onboarding progress from localStorage (fast) + DB
    const localKey = `rp_onboarding_${userId}`;
    const localVisit = parseInt(localStorage.getItem(localKey) ?? '0');

    if (localVisit >= 3) {
      // Fully onboarded — no overlay
      setDismissed(true);
      return;
    }

    const newVisit = localVisit + 1;
    localStorage.setItem(localKey, String(newVisit));
    setVisitNumber(newVisit);

    if (newVisit === 1) {
      setStage('welcome');
    } else if (newVisit === 2) {
      setStage('explore');
    } else if (newVisit === 3) {
      setStage('complete');
    } else {
      setDismissed(true);
    }

    // Also track in activity log
    const supabase = createClient();
    supabase.from('terminal_activity_log').insert({
      user_id: userId,
      action: 'portal_viewed',
      metadata: { visit_number: newVisit },
    });
  }, [userId]);

  const handleDismiss = () => {
    setDismissed(true);
  };

  if (dismissed || !stage) return null;

  // Visit 1: Welcome overlay
  if (stage === 'welcome') {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ background: 'rgba(7,9,15,0.85)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-[520px] text-center animate-fade-up" style={{ animationDuration: '0.5s' }}>
          {/* Progress bar */}
          <div className="flex items-center justify-center gap-2 mb-8">
            {['First Deal', 'Data Room', 'Full Access'].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i === 0 ? 'bg-[#BC9C45] text-[#0E3470]' : 'bg-white/10 text-white/30'
                }`}>
                  {i + 1}
                </div>
                <span className={`text-[10px] font-medium ${i === 0 ? 'text-[#BC9C45]' : 'text-white/30'}`}>{step}</span>
                {i < 2 && <div className="w-8 h-px bg-white/10" />}
              </div>
            ))}
          </div>

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
            Take a moment to explore your first deal. It takes 2 minutes.
          </p>

          <button
            onClick={handleDismiss}
            className="px-10 py-4 rounded-xl bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[15px] font-bold shadow-[0_8px_32px_rgba(188,156,69,0.3)] hover:shadow-[0_12px_40px_rgba(188,156,69,0.4)] transition-all hover:-translate-y-0.5"
          >
            Let&apos;s Start →
          </button>

          <button
            onClick={handleDismiss}
            className="block mx-auto mt-4 text-[11px] text-white/20 hover:text-white/40 transition-colors"
          >
            Skip walkthrough
          </button>
        </div>
      </div>
    );
  }

  // Visit 2: Data room prompt
  if (stage === 'explore') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] animate-slide-down">
        <div className="max-w-[800px] mx-auto mt-4 px-4">
          <div className="bg-gradient-to-r from-[#07090F] to-[#0E3470] rounded-xl p-5 shadow-2xl border border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#BC9C45]/20 flex items-center justify-center">
                <span className="text-[18px]">📊</span>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-white">Welcome back, {firstName}.</h3>
                <p className="text-[12px] text-white/40 mt-0.5">
                  Explore the data room — sign the NDA to access confidential documents.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Progress */}
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className={`w-2 h-2 rounded-full ${n <= 2 ? 'bg-[#BC9C45]' : 'bg-white/15'}`} />
                ))}
              </div>
              <button
                onClick={handleDismiss}
                className="px-5 py-2 rounded-lg bg-[#BC9C45] text-[#0E3470] text-[12px] font-bold hover:opacity-90 transition-opacity"
              >
                Let&apos;s Go →
              </button>
              <button onClick={handleDismiss} className="text-white/20 hover:text-white/40 text-[18px] transition-colors">×</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Visit 3: Full access unlock
  if (stage === 'complete') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[200] animate-slide-down">
        <div className="max-w-[800px] mx-auto mt-4 px-4">
          <div className="bg-gradient-to-r from-[#0B8A4D] to-[#34D399] rounded-xl p-5 shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div>
                <h3 className="text-[14px] font-semibold text-white">Your deal board is fully unlocked.</h3>
                <p className="text-[12px] text-white/60 mt-0.5">
                  All opportunities, compare tools, and portfolio tracking are now available.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="w-2 h-2 rounded-full bg-white" />
                ))}
              </div>
              <span className="text-[11px] font-bold text-white/60">Visit 3/3 ✓</span>
              <button onClick={handleDismiss} className="text-white/40 hover:text-white text-[18px] transition-colors">×</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
