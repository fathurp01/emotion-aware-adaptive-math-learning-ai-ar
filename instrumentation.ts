/**
 * Next.js Instrumentation Hook
 * 
 * This file is automatically called by Next.js when the server starts.
 * We use it to run startup checks and initialize the system.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server side
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { runStartupChecks } = await import('./lib/startup');
    
    // Run all startup checks
    await runStartupChecks();
  }
}
