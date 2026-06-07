#!/usr/bin/env tsx

/**
 * System Health Check Script
 * 
 * Run this script to manually check the system health at any time:
 * npm run health-check
 * 
 * This will verify:
 * - Database connectivity
 * - AI model availability
 * - Environment configuration
 * - All critical dependencies
 */

import { runStartupChecks } from '../lib/startup';

async function main() {
  console.log('Running system health check...\n');
  
  const results = await runStartupChecks();
  
  // Exit with error code if there are any errors
  const hasErrors = results.some(r => r.status === 'error');
  process.exit(hasErrors ? 1 : 0);
}

main().catch((error) => {
  console.error('Health check failed:', error);
  process.exit(1);
});
