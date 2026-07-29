import type { Metadata } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const outfit = Outfit({
  variable: '--font-outfit',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'GariLeloAI — Find Your Perfect Car with AI',
  description:
    'GariLeloAI aggregates car listings from OLX, PakWheels, and CarFirst. Use AI-powered search to find your dream car in Pakistan without the endless scrolling.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
