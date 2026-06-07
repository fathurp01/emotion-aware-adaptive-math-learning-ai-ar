import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import AuthBootstrap from '@/components/auth/AuthBootstrap';
import 'katex/dist/katex.min.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'Emotion-Aware Learning System',
  description: 'Made with passion for learning',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthBootstrap />
        {children}
        <footer className="px-4 py-6 text-center text-xs text-gray-500">
          Made with passion for learning.
        </footer>
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
