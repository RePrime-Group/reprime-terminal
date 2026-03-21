import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  style: ['normal', 'italic'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'RePrime Terminal',
  description: 'Institutional commercial real estate investment platform',
  openGraph: {
    title: 'RePrime Terminal',
    description: 'Institutional commercial real estate investment platform',
    images: [{ url: '/images/og-image.jpg', width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html suppressHydrationWarning>
      <body className={`${inter.variable} ${playfairDisplay.variable} font-[family-name:var(--font-inter)] antialiased`}>
        {children}
      </body>
    </html>
  );
}
