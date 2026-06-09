'use client';

import { useRouter } from 'next/navigation';

/** Lets staff switch which group's curated tab they are previewing. */
export default function CuratedPreviewPicker({
  groups,
  currentId,
  locale,
}: {
  groups: { id: string; name: string }[];
  currentId: string;
  locale: string;
}) {
  const router = useRouter();
  return (
    <div className="relative">
      <select
        value={currentId}
        onChange={(e) => router.push(`/${locale}/admin/preview/curated/${e.target.value}`)}
        className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-[12px] font-semibold bg-white/10 text-white border border-white/20 hover:border-[#BC9C45] focus:outline-none cursor-pointer transition-colors"
      >
        {groups.map((g) => (
          <option key={g.id} value={g.id} className="text-[#0E3470]">
            {g.name}
          </option>
        ))}
      </select>
      <svg className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/60" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
