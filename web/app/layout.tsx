import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'WeMadeIt',
  description: 'CRM + project delivery'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

