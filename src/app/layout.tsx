import type { Metadata } from 'next';
import { Poppins, Bodoni_Moda } from 'next/font/google';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const bodoniModa = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '700', '800'],
  style: ['normal', 'italic'],
  variable: '--font-bodoni',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RePrime Terminal',
  description: 'Institutional commercial real estate investment platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${poppins.variable} ${bodoniModa.variable} font-[family-name:var(--font-poppins)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
