import type { Metadata, Viewport } from 'next';
import '@fontsource/bodoni-moda/400.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import '@fontsource/jost/300.css';
import '@fontsource/jost/400.css';
import '@fontsource/jost/500.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'ISHÉ · Private Showroom',
  description: 'Step inside the ISHÉ private, appointment-only jewellery showroom.',
  icons: { icon: '/brand/favicon.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#1b2330' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
