#!/usr/bin/env node

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

// Load Next.js environment variables
const { loadEnvConfig } = require('@next/env');
const projectDir = process.cwd();
loadEnvConfig(projectDir);

// Import and run startup checks
async function main() {
  console.log('Running system health check...\n');
  
  const { runStartupChecks } = require('../lib/startup');
  const results = await runStartupChecks();
  
  // Exit with error code if there are any errors
  const hasErrors = results.some(r => r.status === 'error');
  process.exit(hasErrors ? 1 : 0);
}

main().catch((error) => {
  console.error('Health check failed:', error);
  process.exit(1);
});
