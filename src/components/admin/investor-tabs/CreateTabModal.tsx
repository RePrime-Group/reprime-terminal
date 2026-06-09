'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { createInvestorTab } from '@/app/[locale]/(admin)/admin/investor-tabs/actions';

export default function CreateTabModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations('admin.investorTabs');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    const res = await createInvestorTab(name);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setName('');
    if (res.id) onCreated(res.id);
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('createGroup')}>
      <div className="flex flex-col gap-4">
        <Input
          label={t('groupNameLabel')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('groupNamePlaceholder')}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
          }}
        />
        {error && <p className="text-xs text-rp-red">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <Button variant="secondary" size="sm" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="gold" size="sm" onClick={handleCreate} loading={saving} disabled={!name.trim()}>
            {t('createGroup')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
