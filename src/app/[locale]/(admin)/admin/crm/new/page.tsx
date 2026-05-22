import CrmInvestorFormClient from '@/components/admin/crm/CrmInvestorFormClient';

export const metadata = { title: 'Add Investor — RePrime Terminal Beta Admin' };

interface NewInvestorPageProps {
  params: Promise<{ locale: string }>;
}

export default async function NewInvestorPage({ params }: NewInvestorPageProps) {
  const { locale } = await params;
  return <CrmInvestorFormClient locale={locale} />;
}
