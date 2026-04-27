'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  ANNUAL_INCOME_OPTIONS,
  INVESTMENT_RANGE_OPTIONS,
  NET_WORTH_OPTIONS,
  SOURCE_OF_FUNDS_OPTIONS,
  type KYCFormData,
} from '@/lib/kyc/types';

interface KYCFormClientProps {
  locale: string;
  initialData: KYCFormData | null;
  userEmail: string;
  defaultLegalName: string;
  /**
   * Server-decrypted last-4 mask (e.g. "***-**-1234") if the user has a
   * previously-saved SSN. Plaintext is never sent to the client. Null when
   * no SSN is on file yet.
   */
  savedSSNMask: string | null;
}

const EMPTY_FORM: KYCFormData = {
  personal: {
    legalName: '',
    dob: '',
    ssn: '',
    driversLicense: '',
    address: { street: '', city: '', state: '', zip: '', country: 'United States' },
    phone: '',
    email: '',
  },
  employment: {
    occupation: '',
    employer: '',
    employerAddress: '',
    industry: '',
    annualIncome: '',
    sourceOfFunds: '',
  },
  financial: {
    netWorth: '',
    investmentRange: '',
    otherInstitutions: { hasAccounts: false, institutionName: '' },
  },
  accreditation: {
    individualIncome: false,
    jointIncome: false,
    netWorthExceeds1M: false,
    licensedProfessional: false,
    knowledgeableEmployee: false,
    entityAssets: false,
    notAccredited: false,
  },
  certifiedTrue: false,
};

function mergeInitial(initial: KYCFormData | null, defaultName: string, email: string): KYCFormData {
  const base = initial ?? EMPTY_FORM;
  return {
    ...base,
    personal: {
      ...base.personal,
      legalName: base.personal?.legalName || defaultName,
      email: base.personal?.email || email,
      // Never re-hydrate SSN from server (it's encrypted; partial save keeps it server-side).
      ssn: '',
    },
  };
}

const inputCls =
  'w-full px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg text-[14px] text-[#0E3470] focus:outline-none focus:ring-[3px] focus:ring-[#BC9C45]/15 focus:border-[#BC9C45] placeholder:text-[#9CA3AF] transition-all bg-white';
const labelCls = 'block text-[12px] font-medium text-[#4B5563] mb-1';
const sectionTitleCls = 'text-[11px] font-semibold text-[#0E3470] uppercase tracking-[1.5px] mb-4';

export default function KYCFormClient({
  locale,
  initialData,
  userEmail,
  defaultLegalName,
  savedSSNMask,
}: KYCFormClientProps) {
  const router = useRouter();
  const [form, setForm] = useState<KYCFormData>(() =>
    mergeInitial(initialData, defaultLegalName, userEmail),
  );
  const [submitting, setSubmitting] = useState(false);
  const [savingPartial, setSavingPartial] = useState(false);
  const [error, setError] = useState('');
  // SSN edit mode. When a saved SSN is on file the input is hidden until the
  // user explicitly clicks "Change" — re-typing isn't required to submit.
  const [editingSSN, setEditingSSN] = useState<boolean>(savedSSNMask == null);

  // Helpers for nested state updates
  type FormUpdater<T> = (prev: T) => T;
  const updatePersonal = (u: FormUpdater<KYCFormData['personal']>) =>
    setForm((p) => ({ ...p, personal: u(p.personal) }));
  const updateAddress = (field: keyof KYCFormData['personal']['address'], val: string) =>
    setForm((p) => ({
      ...p,
      personal: { ...p.personal, address: { ...p.personal.address, [field]: val } },
    }));
  const updateEmployment = (u: FormUpdater<KYCFormData['employment']>) =>
    setForm((p) => ({ ...p, employment: u(p.employment) }));
  const updateFinancial = (u: FormUpdater<KYCFormData['financial']>) =>
    setForm((p) => ({ ...p, financial: u(p.financial) }));
  const updateAccreditation = (key: keyof KYCFormData['accreditation'], val: boolean) =>
    setForm((p) => {
      const next = { ...p.accreditation, [key]: val };
      // "None of the above" is mutually exclusive with the qualifying boxes.
      if (key === 'notAccredited' && val) {
        next.individualIncome = false;
        next.jointIncome = false;
        next.netWorthExceeds1M = false;
        next.licensedProfessional = false;
        next.knowledgeableEmployee = false;
        next.entityAssets = false;
      } else if (key !== 'notAccredited' && val) {
        next.notAccredited = false;
      }
      return { ...p, accreditation: next };
    });

  const submit = async (partial: boolean) => {
    setError('');
    if (partial) setSavingPartial(true);
    else setSubmitting(true);
    try {
      const res = await fetch('/api/onboarding/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: form, partial }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string; approved?: boolean };
      if (!res.ok) {
        setError(body.error ?? 'Failed to submit. Please try again.');
        return;
      }
      if (partial) {
        // Sign out and send to login — user resumes on next login.
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace(`/${locale}/login`);
        router.refresh();
        return;
      }
      // Full submit — go where onboarding routing decides next.
      router.replace(body.approved ? `/${locale}/portal` : `/${locale}/onboarding/pending`);
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
      setSavingPartial(false);
    }
  };

  return (
    <div className="w-full max-w-[860px] mx-auto">
      <div className="text-center mb-6">
        <h1 className="font-[family-name:var(--font-playfair)] text-[24px] md:text-[28px] font-semibold text-[#0E3470] mb-2">
          Investor Verification
        </h1>
        <p className="text-[13px] text-[#6B7280] leading-relaxed max-w-[600px] mx-auto">
          Complete this form to verify your investor status. All information is confidential and used solely for compliance purposes.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-[#EEF0F4] rp-card-shadow p-6 md:p-8 space-y-8">
        {/* Personal Information */}
        <section>
          <div className={sectionTitleCls}>Personal Information</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Full Legal Name *</label>
              <input
                type="text"
                className={inputCls}
                value={form.personal.legalName}
                onChange={(e) => updatePersonal((p) => ({ ...p, legalName: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Date of Birth *</label>
              <input
                type="date"
                className={inputCls}
                value={form.personal.dob}
                onChange={(e) => updatePersonal((p) => ({ ...p, dob: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Social Security / Tax ID *</label>
              {editingSSN ? (
                <>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="XXX-XX-XXXX"
                    className={inputCls}
                    value={form.personal.ssn}
                    onChange={(e) => updatePersonal((p) => ({ ...p, ssn: e.target.value }))}
                    autoComplete="off"
                  />
                  {savedSSNMask && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSSN(false);
                        updatePersonal((p) => ({ ...p, ssn: '' }));
                      }}
                      className="mt-1 text-[11px] text-[#6B7280] hover:text-[#0E3470]"
                    >
                      Cancel — keep saved SSN
                    </button>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border border-[#D1D5DB] rounded-lg bg-[#F7F8FA]">
                  <div className="flex items-center gap-2 text-[13px] text-[#0E3470]">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0B8A4D" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="font-medium">SSN on file</span>
                    <span className="text-[#6B7280] tabular-nums">{savedSSNMask}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingSSN(true)}
                    className="text-[12px] font-medium text-[#0E3470] hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className={labelCls}>Driver&apos;s License #</label>
              <input
                type="text"
                className={inputCls}
                value={form.personal.driversLicense ?? ''}
                onChange={(e) => updatePersonal((p) => ({ ...p, driversLicense: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Address *</label>
              <input
                type="text"
                className={inputCls}
                value={form.personal.address.street}
                onChange={(e) => updateAddress('street', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-3 md:col-span-2">
              <div>
                <label className={labelCls}>City *</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.personal.address.city}
                  onChange={(e) => updateAddress('city', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>State *</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.personal.address.state}
                  onChange={(e) => updateAddress('state', e.target.value)}
                />
              </div>
              <div>
                <label className={labelCls}>Zip *</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.personal.address.zip}
                  onChange={(e) => updateAddress('zip', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className={labelCls}>Country</label>
              <input
                type="text"
                className={inputCls}
                value={form.personal.address.country}
                onChange={(e) => updateAddress('country', e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Phone Number *</label>
              <input
                type="tel"
                className={inputCls}
                value={form.personal.phone}
                onChange={(e) => updatePersonal((p) => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Email Address</label>
              <input
                type="email"
                className={inputCls}
                value={form.personal.email}
                onChange={(e) => updatePersonal((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>
        </section>

        <hr className="border-[#EEF0F4]" />

        {/* Employment & Income */}
        <section>
          <div className={sectionTitleCls}>Employment &amp; Income</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Occupation *</label>
              <input
                type="text"
                className={inputCls}
                value={form.employment.occupation}
                onChange={(e) => updateEmployment((p) => ({ ...p, occupation: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Employer Name *</label>
              <input
                type="text"
                className={inputCls}
                value={form.employment.employer}
                onChange={(e) => updateEmployment((p) => ({ ...p, employer: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Employer Address</label>
              <input
                type="text"
                className={inputCls}
                value={form.employment.employerAddress ?? ''}
                onChange={(e) => updateEmployment((p) => ({ ...p, employerAddress: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Type of Business / Industry</label>
              <input
                type="text"
                className={inputCls}
                value={form.employment.industry ?? ''}
                onChange={(e) => updateEmployment((p) => ({ ...p, industry: e.target.value }))}
              />
            </div>
            <div>
              <label className={labelCls}>Annual Income *</label>
              <select
                className={inputCls}
                value={form.employment.annualIncome}
                onChange={(e) => updateEmployment((p) => ({ ...p, annualIncome: e.target.value }))}
              >
                <option value="">Select…</option>
                {ANNUAL_INCOME_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Source of Funds *</label>
              <select
                className={inputCls}
                value={form.employment.sourceOfFunds}
                onChange={(e) => updateEmployment((p) => ({ ...p, sourceOfFunds: e.target.value }))}
              >
                <option value="">Select…</option>
                {SOURCE_OF_FUNDS_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <hr className="border-[#EEF0F4]" />

        {/* Financial Profile */}
        <section>
          <div className={sectionTitleCls}>Financial Profile</div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Estimated Net Worth *</label>
              <select
                className={inputCls}
                value={form.financial.netWorth}
                onChange={(e) => updateFinancial((p) => ({ ...p, netWorth: e.target.value }))}
              >
                <option value="">Select…</option>
                {NET_WORTH_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Expected Investment Range</label>
              <select
                className={inputCls}
                value={form.financial.investmentRange ?? ''}
                onChange={(e) => updateFinancial((p) => ({ ...p, investmentRange: e.target.value }))}
              >
                <option value="">Select…</option>
                {INVESTMENT_RANGE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Do you have investment accounts at other institutions? *</label>
              <div className="flex gap-3 mt-1">
                {[
                  { v: true, label: 'Yes' },
                  { v: false, label: 'No' },
                ].map((opt) => (
                  <button
                    type="button"
                    key={String(opt.v)}
                    onClick={() =>
                      updateFinancial((p) => ({
                        ...p,
                        otherInstitutions: { ...p.otherInstitutions, hasAccounts: opt.v },
                      }))
                    }
                    className={`px-4 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                      form.financial.otherInstitutions.hasAccounts === opt.v
                        ? 'border-[#BC9C45] bg-[#FDF8ED] text-[#0E3470]'
                        : 'border-[#D1D5DB] bg-white text-[#6B7280] hover:border-[#BC9C45]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {form.financial.otherInstitutions.hasAccounts && (
              <div className="md:col-span-2">
                <label className={labelCls}>Institution name</label>
                <input
                  type="text"
                  className={inputCls}
                  value={form.financial.otherInstitutions.institutionName ?? ''}
                  onChange={(e) =>
                    updateFinancial((p) => ({
                      ...p,
                      otherInstitutions: { ...p.otherInstitutions, institutionName: e.target.value },
                    }))
                  }
                />
              </div>
            )}
          </div>
        </section>

        <hr className="border-[#EEF0F4]" />

        {/* Accreditation */}
        <section>
          <div className={sectionTitleCls}>Accredited Investor Certification</div>
          <p className="text-[12px] text-[#6B7280] mb-4">
            I certify that I meet at least one of the following criteria (check all that apply):
          </p>
          <div className="space-y-2">
            {[
              { key: 'individualIncome', label: 'Individual income exceeding $200,000 in each of the two most recent years, with reasonable expectation of the same in the current year' },
              { key: 'jointIncome', label: 'Joint income with spouse/partner exceeding $300,000 in each of the two most recent years, with reasonable expectation of the same in the current year' },
              { key: 'netWorthExceeds1M', label: 'Net worth exceeding $1,000,000 (individually or jointly with spouse/partner), excluding primary residence' },
              { key: 'licensedProfessional', label: 'Licensed securities professional holding Series 7, 65, or 82 in good standing' },
              { key: 'knowledgeableEmployee', label: 'Knowledgeable employee of a private fund' },
              { key: 'entityAssets', label: 'Entity with assets exceeding $5,000,000' },
              { key: 'notAccredited', label: 'None of the above — I am not an accredited investor' },
            ].map((opt) => {
              const checked = form.accreditation[opt.key as keyof KYCFormData['accreditation']];
              return (
                <label
                  key={opt.key}
                  onClick={() =>
                    updateAccreditation(opt.key as keyof KYCFormData['accreditation'], !checked)
                  }
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border transition-colors ${
                    checked ? 'border-[#BC9C45] bg-[#FDF8ED]' : 'border-[#EEF0F4] bg-white hover:border-[#D1D5DB]'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
                      checked ? 'border-[#BC9C45] bg-[#BC9C45]' : 'border-[#D1D5DB] bg-white'
                    }`}
                  >
                    {checked && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-[12px] text-[#4B5563] leading-relaxed">{opt.label}</span>
                </label>
              );
            })}
          </div>
        </section>

        <hr className="border-[#EEF0F4]" />

        {/* Certify */}
        <label
          onClick={() => setForm((p) => ({ ...p, certifiedTrue: !p.certifiedTrue }))}
          className={`flex items-start gap-3 p-3.5 rounded-lg cursor-pointer border transition-colors ${
            form.certifiedTrue ? 'border-[#BC9C45] bg-[#FDF8ED]' : 'border-[#EEF0F4] bg-[#F7F8FA]'
          }`}
        >
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 shrink-0 transition-colors ${
              form.certifiedTrue ? 'border-[#BC9C45] bg-[#BC9C45]' : 'border-[#D1D5DB] bg-white'
            }`}
          >
            {form.certifiedTrue && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
          <span className="text-[12px] text-[#4B5563] leading-relaxed">
            I certify that the information provided above is true and accurate to the best of my knowledge. *
          </span>
        </label>

        {error && (
          <div className="p-3 bg-[#FEF2F2] border border-[#FECACA] rounded-lg text-[12px] text-[#DC2626] font-medium">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => submit(false)}
            disabled={submitting || savingPartial}
            className="flex-1 py-3.5 rounded-xl bg-[#BC9C45] hover:bg-[#A88A3D] text-[#0E3470] text-[13px] font-bold transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Verification'}
          </button>
          <button
            onClick={() => submit(true)}
            disabled={submitting || savingPartial}
            className="px-6 py-3.5 rounded-xl border border-[#EEF0F4] text-[#6B7280] text-[12px] font-medium hover:bg-[#F7F8FA] transition-colors disabled:opacity-50"
          >
            {savingPartial ? 'Saving…' : 'Save & Continue Later'}
          </button>
        </div>
      </div>
    </div>
  );
}
