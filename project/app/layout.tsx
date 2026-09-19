import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SVASTH Queue — Smart OPD Queue Management',
  description:
    'Digital QR-based OPD queue management system. Scan, register, and track your hospital queue position in real-time.',
  keywords: ['OPD', 'queue', 'hospital', 'digital', 'QR', 'patient', 'tracking'],
  authors: [{ name: 'SVASTH' }],
  openGraph: {
    title: 'SVASTH Queue — Smart OPD Queue Management',
    description: 'Skip the chaos. Track your OPD queue in real-time.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body>
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
