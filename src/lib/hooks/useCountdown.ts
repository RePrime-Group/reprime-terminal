'use client';

import { useState, useEffect } from 'react';

interface CountdownValues {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isUrgent: boolean;
  totalMs: number;
}

export function useCountdown(targetDate: string | null): CountdownValues {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!targetDate) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, isUrgent: false, totalMs: 0 };
  }

  const target = new Date(targetDate).getTime();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, isUrgent: false, totalMs: 0 };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    isUrgent: days < 2,
    totalMs: diff,
  };
}

export function getUrgencyLevel(targetDate: string | null): 'green' | 'amber' | 'red' | 'expired' | 'assigned' {
  if (!targetDate) return 'expired';
  const diff = new Date(targetDate).getTime() - Date.now();
  if (diff <= 0) return 'expired';
  const days = diff / (1000 * 60 * 60 * 24);
  if (days <= 2) return 'red';
  if (days <= 7) return 'amber';
  return 'green';
}
