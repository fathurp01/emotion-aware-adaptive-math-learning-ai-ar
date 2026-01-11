import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Emotion-Aware Learning System',
  description: 'Adaptive learning platform with real-time emotion detection and AI-powered personalization',
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
        <Toaster 
          position="top-right" 
          richColors 
          closeButton
          duration={4000}
        />
      </body>
    </html>
  );
}
