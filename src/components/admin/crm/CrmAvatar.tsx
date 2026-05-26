'use client';

/* eslint-disable @next/next/no-img-element */

function initials(first: string, last: string): string {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

export function CrmAvatar({
  firstName,
  lastName,
  photoUrl,
  size = 44,
}: {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: number;
}) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${firstName} ${lastName}`}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 text-white font-semibold"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: 'linear-gradient(135deg, #D4B96A 0%, #BC9C45 100%)',
      }}
    >
      {initials(firstName, lastName)}
    </div>
  );
}
