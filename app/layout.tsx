import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI Track',
  description: 'A ranked feed of today\'s most important AI news, updated hourly.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
