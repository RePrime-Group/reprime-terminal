'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'gold' | 'secondary' | 'danger' | 'ghost' | 'subscribe' | 'subscribed';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-rp-navy text-white hover:bg-rp-navy/90',
  gold: 'bg-gradient-to-r from-rp-gold to-rp-gold-soft text-white hover:opacity-90',
  secondary: 'bg-white border border-rp-gray-300 text-rp-gray-700 hover:bg-rp-gray-100',
  danger: 'bg-rp-red text-white hover:bg-rp-red/90',
  ghost: 'bg-transparent text-rp-gray-500 hover:bg-rp-gray-100',
  subscribe: 'bg-transparent border border-rp-gold/30 text-rp-gold hover:bg-rp-gold/5 hover:border-rp-gold/50',
  subscribed: 'bg-rp-gold/[0.08] border border-rp-gold/20 text-rp-gold',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-sm',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center rounded-lg font-semibold transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `.trim()}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 mr-2 h-4 w-4 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
