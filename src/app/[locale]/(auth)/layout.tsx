import BetaLaunchBanner from '@/components/BetaLaunchBanner';

export const metadata = { title: 'Sign In — RePrime Terminal Beta' };

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BetaLaunchBanner />
    </>
  );
}
