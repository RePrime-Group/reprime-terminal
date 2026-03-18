'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import LoginCard from '@/components/login/LoginCard';

const LoginScene = dynamic(() => import('@/components/login/LoginScene'), {
  ssr: false,
});

export default function LoginPage() {
  const params = useParams();
  const locale = (params.locale as string) || 'en';

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#07090F' }}>
      {/* Background layers */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: `
            radial-gradient(ellipse at 30% 20%, rgba(14,52,112,0.3) 0%, transparent 60%),
            radial-gradient(ellipse at 70% 80%, rgba(188,156,69,0.08) 0%, transparent 50%)
          `,
        }}
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      {/* Three.js particles */}
      <LoginScene />
      {/* Login form */}
      <div className="relative z-10 flex items-center justify-center min-h-screen px-4">
        <LoginCard locale={locale} />
      </div>
    </div>
  );
}
