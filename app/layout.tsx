import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  variable: '--font-inter',
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
    <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
