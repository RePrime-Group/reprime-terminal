import { Link } from '@/i18n/navigation';

export const metadata = { title: 'Join RePrime Terminal — Institutional CRE Investment Access' };

const features = [
  { icon: '🏢', title: 'Institutional Deals', desc: 'Access off-market CRE opportunities with institutional-grade underwriting.' },
  { icon: '📊', title: 'Full Data Room', desc: 'Complete due diligence materials — financials, legal, environmental, property condition.' },
  { icon: '⚡', title: 'Real-Time Pipeline', desc: 'Track deal progress from LOI through closing with live task completion.' },
  { icon: '📈', title: 'Financial Modeling', desc: 'Interactive tools to model returns with custom assumptions.' },
  { icon: '🔒', title: 'NDA-Protected', desc: 'Confidential access with watermarked documents and audit trails.' },
  { icon: '📅', title: 'Direct Access', desc: 'Schedule meetings directly with our acquisition team.' },
];

export default async function JoinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #07090F 0%, #0A1628 40%, #0E3470 100%)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-10 py-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded-lg flex items-center justify-center shadow-[0_2px_8px_rgba(188,156,69,0.3)]">
            <span className="text-white font-bold text-lg font-[family-name:var(--font-playfair)] italic">R</span>
          </div>
          <span className="text-white font-medium text-[14px] tracking-[4px] uppercase">REPRIME</span>
          <span className="font-[family-name:var(--font-playfair)] text-[#D4A843] italic text-[11px]">Terminal</span>
        </div>
        <Link
          href="/login"
          locale={locale}
          className="px-5 py-2 border border-white/15 text-white/70 text-[12px] font-medium rounded-lg hover:bg-white/5 transition-colors"
        >
          Investor Login
        </Link>
      </nav>

      {/* Hero */}
      <div className="max-w-[1100px] mx-auto px-10 pt-16 pb-20">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] mb-6">
            <div className="w-1.5 h-1.5 rounded-full bg-[#0B8A4D] live-dot" />
            <span className="text-[10px] font-medium tracking-[2px] text-[#D4A843] uppercase">Now Accepting Qualified Members</span>
          </div>
          <h1 className="font-[family-name:var(--font-playfair)] text-[52px] font-semibold text-white leading-[1.1] tracking-[-0.02em] mb-5">
            Institutional-Grade CRE<br />Investment Access
          </h1>
          <p className="text-[16px] text-white/40 max-w-[600px] mx-auto leading-relaxed font-light">
            The RePrime Terminal connects qualified investors with off-market commercial real
            estate opportunities backed by 30+ years of institutional diligence.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-3 gap-5 mb-16">
          {features.map((f, i) => (
            <div
              key={i}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all"
            >
              <div className="text-[24px] mb-3">{f.icon}</div>
              <h3 className="text-[14px] font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-[12px] text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-10 text-center">
          <h2 className="font-[family-name:var(--font-playfair)] text-[28px] font-semibold text-white mb-3">
            Request Access
          </h2>
          <p className="text-[14px] text-white/40 mb-8 max-w-[500px] mx-auto">
            Terminal membership is by invitation. Submit your information and our team will
            review your application within 48 hours.
          </p>

          <form className="max-w-[440px] mx-auto flex flex-col gap-4">
            <input
              type="text"
              placeholder="Full Name"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors"
            />
            <input
              type="email"
              placeholder="Email Address"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors"
            />
            <input
              type="text"
              placeholder="Company / Fund Name"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors"
            />
            <input
              type="tel"
              placeholder="Phone Number"
              className="w-full px-4 py-3 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white text-[14px] placeholder:text-white/25 focus:outline-none focus:border-[#D4A843]/40 transition-colors"
            />
            <button
              type="submit"
              className="w-full py-3.5 rounded-lg bg-gradient-to-r from-[#BC9C45] to-[#D4B96A] text-[#0E3470] text-[14px] font-bold hover:opacity-90 transition-opacity shadow-[0_6px_24px_rgba(188,156,69,0.3)] mt-2"
            >
              Request Access
            </button>
          </form>

          <p className="text-[11px] text-white/20 mt-6">
            By submitting, you agree to our confidentiality terms. Membership is subject to verification.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-6 mt-16 pb-10">
          {[
            { value: '$200M+', label: 'Deal Volume' },
            { value: '30+', label: 'Years Experience' },
            { value: '100%', label: 'Institutional Diligence' },
            { value: '48hr', label: 'Application Review' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-[28px] font-bold text-white tabular-nums">{s.value}</div>
              <div className="text-[11px] text-white/30 font-medium uppercase tracking-[1.5px] mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-10 py-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gradient-to-br from-[#BC9C45] to-[#A88A3D] rounded flex items-center justify-center">
            <span className="text-white text-[8px] font-bold font-[family-name:var(--font-playfair)] italic">R</span>
          </div>
          <span className="text-[10px] text-white/20 tracking-wide">REPRIME TERMINAL</span>
        </div>
        <p className="text-[10px] text-white/20">
          &copy; {new Date().getFullYear()} RePrime Group. All rights reserved. All investments involve risk.
        </p>
      </div>
    </div>
  );
}
