import CrmImportClient from '@/components/admin/crm/CrmImportClient';

export const metadata = { title: 'Import Investors — RePrime Terminal Beta Admin' };

interface ImportPageProps {
  params: Promise<{ locale: string }>;
}

export default async function CrmImportPage({ params }: ImportPageProps) {
  const { locale } = await params;
  return <CrmImportClient locale={locale} />;
}
