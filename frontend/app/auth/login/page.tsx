/**
 * Login Page (Server Wrapper)
 * 
 * Wraps the client login form in Suspense to satisfy Next.js requirements
 * when using useSearchParams() inside a client component.
 */

import { Suspense } from 'react';
import LoginClient from './LoginClient';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginClient />
    </Suspense>
  );
}
