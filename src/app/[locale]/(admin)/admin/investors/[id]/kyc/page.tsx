import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { bufferFromBytea, decryptSSN, maskSSN } from '@/lib/kyc/encryption';
import KYCReviewActions from '@/components/admin/KYCReviewActions';
import type { KYCFormData } from '@/lib/kyc/types';

export const metadata = { title: 'KYC Review — RePrime Terminal Beta Admin' };
export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ locale: string; id: string }>;
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-rp-gray-500 uppercase tracking-[1px] mb-1">{label}</div>
      <div className="text-[13px] text-[#0E3470]">{children || <span className="text-rp-gray-400">—</span>}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-rp-gray-200 p-5">
      <div className="text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-4">{title}</div>
      {children}
    </section>
  );
}

export default async function AdminKYCReviewPage({ params }: PageProps) {
  const { locale, id } = await params;
  const supabase = await createClient();

  const [profileRes, kycRes, ndaRes] = await Promise.all([
    supabase
      .from('terminal_users')
      .select('id, full_name, email, role, company_name, created_at, last_active_at')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('terminal_user_kyc')
      .select('*')
      .eq('user_id', id)
      .maybeSingle(),
    supabase
      .from('terminal_nda_signatures')
      .select('id, nda_type, signed_at, signer_name, signer_company, signer_title, ip_address, deal_id')
      .eq('user_id', id)
      .order('signed_at', { ascending: false }),
  ]);

  const profile = profileRes.data;
  const kyc = kycRes.data;
  const ndas = ndaRes.data ?? [];
  if (!profile || profile.role !== 'investor') notFound();

  const data = (kyc?.data ?? null) as KYCFormData | null;

  // Decrypt SSN server-side; mask to last 4 before returning to the client.
  // Plaintext never reaches the browser. If decryption fails (missing key,
  // malformed blob), fall back to a generic mask so the page still renders.
  let ssnMasked = '—';
  if (kyc?.ssn_encrypted) {
    try {
      const buf = bufferFromBytea(kyc.ssn_encrypted);
      ssnMasked = maskSSN(decryptSSN(buf));
    } catch {
      ssnMasked = '***-**-****';
    }
  }

  const blanket = ndas.find((n) => n.nda_type === 'blanket');

  return (
    <div className="max-w-[960px]">
      <div className="mb-5">
        <Link href={`/${locale}/admin/investors`} className="text-[12px] text-rp-gray-500 hover:text-rp-navy transition-colors">
          ← Back to investors
        </Link>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-rp-navy">{profile.full_name}</h1>
          <div className="text-[13px] text-rp-gray-500 mt-1">
            {profile.email} · joined {fmtDate(profile.created_at)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold text-rp-gray-500 uppercase tracking-[1px] mb-1">KYC Status</div>
          {kyc?.rejected_at ? (
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] text-[#991B1B] bg-[#FEE2E2] border border-[#FECACA] rounded px-2 py-0.5">Rejected</span>
          ) : kyc?.approved ? (
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] text-[#166534] bg-[#DCFCE7] border border-[#BBF7D0] rounded px-2 py-0.5">Approved</span>
          ) : kyc?.completed_at ? (
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] text-[#9F580B] bg-[#FFF7ED] border border-[#FED7AA] rounded px-2 py-0.5">Pending review</span>
          ) : kyc?.data ? (
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] text-[#92400E] bg-[#FEF3C7] border border-[#FDE68A] rounded px-2 py-0.5">Partial</span>
          ) : (
            <span className="inline-block text-[11px] font-bold uppercase tracking-[0.1em] text-rp-gray-500 bg-rp-gray-100 rounded px-2 py-0.5">Not started</span>
          )}
        </div>
      </header>

      <div className="space-y-5">
        {/* Approval actions */}
        {kyc?.completed_at && (
          <Section title="Approval actions">
            <KYCReviewActions
              investorId={id}
              approved={!!kyc.approved}
              rejected={!!kyc.rejected_at}
            />
            {kyc.approved && (
              <div className="text-[12px] text-rp-gray-500 mt-3">
                Approved {fmtDate(kyc.approved_at)} by {kyc.approved_by ?? '—'}
              </div>
            )}
            {kyc.rejected_at && (
              <div className="text-[12px] text-[#991B1B] mt-3">
                Rejected {fmtDate(kyc.rejected_at)}
                {kyc.rejection_reason ? ` — ${kyc.rejection_reason}` : ''}
              </div>
            )}
          </Section>
        )}

        {/* NDA */}
        <Section title="Confidentiality Agreement (Blanket)">
          {blanket ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Signed">{fmtDate(blanket.signed_at)}</Field>
              <Field label="Signer">{blanket.signer_name}</Field>
              <Field label="Company">{blanket.signer_company}</Field>
              <Field label="Title">{blanket.signer_title}</Field>
              <Field label="IP Address">{blanket.ip_address}</Field>
            </div>
          ) : (
            <div className="text-[13px] text-rp-gray-500">Not signed yet.</div>
          )}
        </Section>

        {/* Personal */}
        <Section title="Personal Information">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Legal Name">{data?.personal.legalName}</Field>
            <Field label="Date of Birth">{data?.personal.dob}</Field>
            <Field label="SSN / Tax ID">{ssnMasked}</Field>
            <Field label="Driver's License">{data?.personal.driversLicense}</Field>
            <Field label="Phone">{data?.personal.phone}</Field>
            <Field label="Email">{data?.personal.email}</Field>
            <div className="md:col-span-3">
              <Field label="Address">
                {data?.personal.address ? (
                  <>
                    {data.personal.address.street}
                    {data.personal.address.street ? ', ' : ''}
                    {data.personal.address.city}, {data.personal.address.state} {data.personal.address.zip}
                    {data.personal.address.country ? `, ${data.personal.address.country}` : ''}
                  </>
                ) : null}
              </Field>
            </div>
          </div>
        </Section>

        {/* Employment */}
        <Section title="Employment & Income">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Occupation">{data?.employment.occupation}</Field>
            <Field label="Employer">{data?.employment.employer}</Field>
            <Field label="Industry">{data?.employment.industry}</Field>
            <Field label="Employer Address">{data?.employment.employerAddress}</Field>
            <Field label="Annual Income">{data?.employment.annualIncome}</Field>
            <Field label="Source of Funds">{data?.employment.sourceOfFunds}</Field>
          </div>
        </Section>

        {/* Financial */}
        <Section title="Financial Profile">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Field label="Net Worth">{data?.financial.netWorth}</Field>
            <Field label="Investment Range">{data?.financial.investmentRange}</Field>
            <Field label="Other Institutions">
              {data?.financial.otherInstitutions
                ? data.financial.otherInstitutions.hasAccounts
                  ? `Yes — ${data.financial.otherInstitutions.institutionName ?? '—'}`
                  : 'No'
                : null}
            </Field>
          </div>
        </Section>

        {/* Accreditation */}
        <Section title="Accredited Investor Certification">
          {data?.accreditation ? (
            <ul className="space-y-1.5 text-[13px] text-[#0E3470]">
              {[
                ['individualIncome', 'Individual income > $200K (2 yrs)'],
                ['jointIncome', 'Joint income > $300K (2 yrs)'],
                ['netWorthExceeds1M', 'Net worth > $1M (excl. primary residence)'],
                ['licensedProfessional', 'Licensed Series 7 / 65 / 82'],
                ['knowledgeableEmployee', 'Knowledgeable employee of a private fund'],
                ['entityAssets', 'Entity with assets > $5M'],
                ['notAccredited', 'None of the above (not accredited)'],
              ].map(([k, label]) => {
                const checked = data.accreditation[k as keyof typeof data.accreditation];
                return (
                  <li key={k} className="flex items-center gap-2">
                    <span className={checked ? 'text-[#166534]' : 'text-rp-gray-400'}>{checked ? '☑' : '☐'}</span>
                    <span className={checked ? '' : 'text-rp-gray-400'}>{label}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="text-[13px] text-rp-gray-500">No accreditation data submitted.</div>
          )}
          <div className="mt-3 text-[12px] text-rp-gray-500">
            Truth certified: {data?.certifiedTrue ? 'Yes' : 'No'}
          </div>
        </Section>
      </div>
    </div>
  );
}
