'use client';

import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export default function Input({
  label,
  error,
  className = '',
  id,
  ...props
}: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-[13px] font-medium text-rp-gray-700 mb-1.5"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`
          w-full px-3.5 py-2.5 border rounded-lg text-sm text-rp-gray-700
          focus:outline-none focus:ring-2 focus:ring-rp-gold/20 focus:border-rp-gold
          placeholder:text-rp-gray-400 transition-colors
          ${error ? 'border-rp-red' : 'border-rp-gray-300'}
        `.trim()}
        {...props}
      />
      {error && (
        <p className="mt-1 text-xs text-rp-red">{error}</p>
      )}
    </div>
  );
}
