/**
 * System Startup Logger
 * 
 * Comprehensive logging for system initialization, including:
 * - Database connection status
 * - AI Model availability
 * - Environment configuration
 * - Required dependencies
 */

// No database or AI model client imports on the frontend startup checks


// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Logging helper functions
const log = {
  info: (message: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${message}`),
  success: (message: string) => console.log(`${colors.green}✓${colors.reset} ${message}`),
  warning: (message: string) => console.log(`${colors.yellow}⚠${colors.reset} ${message}`),
  error: (message: string) => console.log(`${colors.red}✗${colors.reset} ${message}`),
  section: (message: string) => console.log(`\n${colors.bright}${colors.blue}═══ ${message} ═══${colors.reset}`),
};

export interface StartupCheckResult {
  status: 'success' | 'warning' | 'error';
  component: string;
  message: string;
  details?: any;
}

/**
 * Check environment variables for Frontend
 */
function checkEnvironment(): StartupCheckResult {
  log.info('Checking environment configuration...');
  
  const requiredEnvVars = ['BACKEND_API_URL', 'AUTH_SECRET'];
  
  const missingVars: string[] = [];
  const presentVars: string[] = [];
  
  for (const varName of requiredEnvVars) {
    if (process.env[varName]) {
      presentVars.push(varName);
    } else {
      missingVars.push(varName);
    }
  }
  
  if (missingVars.length > 0) {
    log.error(`Missing environment variables: ${missingVars.join(', ')}`);
    return {
      status: 'error',
      component: 'Environment',
      message: `Missing required variables: ${missingVars.join(', ')}`,
      details: { missingVars, presentVars },
    };
  }
  
  log.success('All required environment variables are configured');
  log.info(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
  log.info(`  Next.js version: ${require('next/package.json').version}`);
  
  return {
    status: 'success',
    component: 'Environment',
    message: 'All environment variables present',
    details: { presentVars },
  };
}

/**
 * Check TensorFlow.js (for emotion detection)
 */
async function checkTensorFlow(): Promise<StartupCheckResult> {
  try {
    log.info('Checking TensorFlow.js...');

    // NOTE: We intentionally avoid importing the full TFJS runtime here.
    // In Next.js dev, the instrumentation hook can run in multiple node processes,
    // and importing TFJS emits very noisy "backend/kernel already registered" logs.
    // Emotion inference itself happens client-side (see EmotionCamera).

    // Lightweight dependency presence check without executing TFJS.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const tfjsPkg = require('@tensorflow/tfjs/package.json') as { version?: string };

    // Validate model files referenced by env (or defaults).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const path = require('node:path') as typeof import('node:path');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('node:fs') as typeof import('node:fs');

    const modelUrl = process.env.NEXT_PUBLIC_EMOTION_MODEL_URL || '/model/tfjs_model/model.json';
    const metadataUrl = process.env.NEXT_PUBLIC_EMOTION_METADATA_URL || '/model/tfjs_model/metadata.json';

    const resolvePublicPath = (url: string) => {
      const clean = url.startsWith('/') ? url.slice(1) : url;
      return path.join(process.cwd(), 'public', clean);
    };

    const modelPath = resolvePublicPath(modelUrl);
    const metadataPath = resolvePublicPath(metadataUrl);
    const modelExists = fs.existsSync(modelPath);
    const metadataExists = fs.existsSync(metadataPath);

    const status: StartupCheckResult['status'] = (modelExists && metadataExists) ? 'success' : 'warning';

    log.success('TensorFlow.js dependency is present');
    log.info(`  Version: ${tfjsPkg.version || 'unknown'}`);
    log.info(`  Model: ${modelExists ? 'found' : 'missing'} (${modelUrl})`);
    log.info(`  Metadata: ${metadataExists ? 'found' : 'missing'} (${metadataUrl})`);
    if (!modelExists || !metadataExists) {
      log.warning('TensorFlow model files are missing; client-side emotion detection may not work until fixed.');
    }

    return {
      status,
      component: 'TensorFlow.js',
      message: status === 'success' ? 'TFJS dependency + model files look OK' : 'TFJS dependency OK, but model files missing',
      details: {
        version: tfjsPkg.version,
        modelUrl,
        metadataUrl,
        modelExists,
        metadataExists,
      },
    };
  } catch (error: any) {
    log.error(`TensorFlow.js check failed: ${error.message}`);
    return {
      status: 'error',
      component: 'TensorFlow.js',
      message: `Failed to load: ${error.message}`,
    };
  }
}

/**
 * Check Next.js configuration
 */
function checkNextConfig(): StartupCheckResult {
  try {
    log.info('Checking Next.js configuration...');
    
    const nextConfig = require('../next.config.js');
    
    log.success('Next.js configuration loaded');
    log.info(`  Experimental features: ${JSON.stringify(nextConfig.experimental || {})}`);
    
    return {
      status: 'success',
      component: 'Next.js',
      message: 'Configuration loaded',
      details: { config: nextConfig },
    };
  } catch (error: any) {
    log.warning(`Could not load Next.js config: ${error.message}`);
    return {
      status: 'warning',
      component: 'Next.js',
      message: 'Config check skipped',
    };
  }
}

/**
 * Run all startup checks
 */
export async function runStartupChecks(): Promise<StartupCheckResult[]> {
  console.log('\n');
  log.section('🚀 EMOTION-AWARE LEARNING SYSTEM (FRONTEND) - STARTUP');
  console.log(`${colors.cyan}Starting frontend initialization...${colors.reset}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const results: StartupCheckResult[] = [];
  
  // Environment check (synchronous)
  log.section('Environment Configuration');
  results.push(checkEnvironment());
  
  // TensorFlow check
  log.section('Emotion Detection System');
  results.push(await checkTensorFlow());
  
  // Next.js config check
  log.section('Next.js Configuration');
  results.push(checkNextConfig());
  
  // Summary
  log.section('Startup Summary');
  
  const successCount = results.filter(r => r.status === 'success').length;
  const warningCount = results.filter(r => r.status === 'warning').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  
  console.log('\n');
  log.info(`Total checks: ${results.length}`);
  log.success(`Successful: ${successCount}`);
  if (warningCount > 0) log.warning(`Warnings: ${warningCount}`);
  if (errorCount > 0) log.error(`Errors: ${errorCount}`);
  
  if (errorCount > 0) {
    console.log('\n');
    log.error('Frontend startup completed with errors!');
    log.error('Please fix the above errors before using the application.');
    console.log('\n');
  } else if (warningCount > 0) {
    console.log('\n');
    log.warning('Frontend startup completed with warnings.');
    log.info('The application may work with reduced functionality.');
    console.log('\n');
  } else {
    console.log('\n');
    log.success('✨ Frontend is ready to serve pages and proxy API requests.');
    console.log('\n');
  }
  
  return results;
}

/**
 * Graceful shutdown handler
 */
export async function gracefulShutdown() {
  log.section('Shutting Down');
  log.info('Closing database connections...');
  
  try {
    await prisma.$disconnect();
    log.success('Database connections closed');
  } catch (error: any) {
    log.error(`Error during shutdown: ${error.message}`);
  }
  
  log.info('Shutdown complete');
  process.exit(0);
}

// Handle shutdown signals
if (typeof process !== 'undefined') {
  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}
