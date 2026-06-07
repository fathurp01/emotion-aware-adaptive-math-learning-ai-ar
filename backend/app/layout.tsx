import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Emotion-Aware Learning System - API Server',
  description: 'API Endpoints for Emotion-Aware Learning System',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
