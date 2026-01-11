/**
 * System Startup Logger
 * 
 * Comprehensive logging for system initialization, including:
 * - Database connection status
 * - AI Model availability
 * - Environment configuration
 * - Required dependencies
 */

import { prisma } from './db';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { isMistralConfigured, mistralGenerateText } from './mistral';
import { kickOffMaterialPrecomputeOnStartup } from './materialPrecompute';

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

function getGeminiModelName(): string {
  // Default to a broadly available model family; override with GEMINI_MODEL if needed.
  return (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
}

function getMistralModelName(): string {
  return (process.env.MISTRAL_MODEL || 'mistral-small-latest').trim();
}

async function listGeminiModels(apiKey: string): Promise<Array<{ name: string; supportedGenerationMethods?: string[] }>> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ListModels failed (${res.status} ${res.statusText})${body ? `: ${body}` : ''}`);
  }
  const json = (await res.json()) as any;
  const models = Array.isArray(json?.models) ? json.models : [];
  return models.map((m: any) => ({
    name: String(m?.name || ''),
    supportedGenerationMethods: Array.isArray(m?.supportedGenerationMethods) ? m.supportedGenerationMethods : undefined,
  })).filter((m: any) => m.name);
}

/**
 * Check database connection and configuration
 */
async function checkDatabase(): Promise<StartupCheckResult> {
  try {
    log.info('Checking database connection...');
    
    // Test database connection
    await prisma.$connect();
    
    // Get database info
    const result = await prisma.$queryRaw`SELECT version() as version`;
    const dbVersion = (result as any)[0]?.version || 'Unknown';
    
    // Count records in each table
    const [userCount, chapterCount, materialCount, quizCount, emotionCount] = await Promise.all([
      prisma.user.count(),
      prisma.chapter.count(),
      prisma.material.count(),
      prisma.quizLog.count(),
      prisma.emotionLog.count(),
    ]);
    
    log.success(`Database connected successfully`);
    log.info(`  Database: ${dbVersion}`);
    log.info(`  Users: ${userCount}`);
    log.info(`  Chapters: ${chapterCount}`);
    log.info(`  Materials: ${materialCount}`);
    log.info(`  Quiz Logs: ${quizCount}`);
    log.info(`  Emotion Logs: ${emotionCount}`);
    
    return {
      status: 'success',
      component: 'Database',
      message: 'Database connection established',
      details: {
        version: dbVersion,
        counts: { userCount, chapterCount, materialCount, quizCount, emotionCount },
      },
    };
  } catch (error: any) {
    log.error(`Database connection failed: ${error.message}`);
    return {
      status: 'error',
      component: 'Database',
      message: `Failed to connect: ${error.message}`,
    };
  }
}

/**
 * Check Gemini AI Model availability
 */
async function checkGeminiAI(): Promise<StartupCheckResult> {
  try {
    log.info('Checking Gemini AI configuration...');
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      log.error('GEMINI_API_KEY not found in environment variables');
      return {
        status: 'error',
        component: 'Gemini AI',
        message: 'API key not configured',
      };
    }
    
    log.success(`Gemini API key configured (${apiKey.substring(0, 10)}...)`);

    // Quota-friendly option: validate access by listing models, without consuming generateContent quota
    const skipGenerateTest = /^(1|true|yes)$/i.test(String(process.env.GEMINI_HEALTHCHECK_SKIP_GENERATE || ''));
    if (skipGenerateTest) {
      log.info('Skipping generateContent test (GEMINI_HEALTHCHECK_SKIP_GENERATE enabled)');
      const models = await listGeminiModels(apiKey);
      const usable = models
        .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map(m => m.name.replace(/^models\//, ''))
        .slice(0, 10);

      if (usable.length > 0) {
        log.info(`  Available generateContent models (sample): ${usable.join(', ')}`);
      }

      return {
        status: 'success',
        component: 'Gemini AI',
        message: 'API key is configured (generateContent test skipped)',
        details: {
          configuredModel: getGeminiModelName(),
          availableGenerateContentModels: usable,
        },
      };
    }
    
    // Test AI model by making a simple request
    const genAI = new GoogleGenerativeAI(apiKey);
    const configuredModel = getGeminiModelName();
    const model = genAI.getGenerativeModel({ model: configuredModel });
    
    log.info('Testing AI model connection...');
    const result = await model.generateContent('Test connection. Respond with "OK".');
    const response = await result.response;
    const text = response.text();
    
    if (text) {
      log.success('Gemini AI model is responsive');
      log.info(`  Model: ${configuredModel}`);
      log.info(`  Status: Active and ready`);
      
      return {
        status: 'success',
        component: 'Gemini AI',
        message: 'AI model is ready',
        details: {
          model: configuredModel,
          testResponse: text.substring(0, 50),
        },
      };
    } else {
      throw new Error('Empty response from AI model');
    }
  } catch (error: any) {
    log.error(`Gemini AI check failed: ${error.message}`);

    const errorMessage = String(error?.message || '');
    const isQuotaOrRateLimit = /\b429\b|quota exceeded|exceeded your current quota|rate limit/i.test(errorMessage);

    if (isQuotaOrRateLimit) {
      log.warning('Gemini API quota/rate-limit blocked the test request');
      log.info('  AI features may be unavailable until quota/billing is enabled');
      return {
        status: 'warning',
        component: 'Gemini AI',
        message: `Quota/rate-limit blocked AI check: ${errorMessage}`,
        details: {
          configuredModel: getGeminiModelName(),
        },
      };
    }

    // Best-effort diagnostics: list available models (without printing the full API key)
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        const models = await listGeminiModels(apiKey);
        const usable = models
          .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
          .map(m => m.name.replace(/^models\//, ''))
          .slice(0, 15);

        if (usable.length > 0) {
          log.info(`  Available generateContent models (sample): ${usable.join(', ')}`);
          log.info('  Tip: set GEMINI_MODEL to one of these values');
        }

        return {
          status: 'error',
          component: 'Gemini AI',
          message: `AI model unavailable: ${error.message}`,
          details: {
            configuredModel: getGeminiModelName(),
            availableGenerateContentModels: usable,
          },
        };
      }
    } catch {
      // Ignore diagnostic failure and fall through to generic error below
    }

    return {
      status: 'error',
      component: 'Gemini AI',
      message: `AI model unavailable: ${error.message}`,
    };
  }
}

async function checkMistralAI(): Promise<StartupCheckResult> {
  try {
    log.info('Checking Mistral AI configuration...');

    if (!isMistralConfigured()) {
      return {
        status: 'warning',
        component: 'Mistral AI',
        message: 'Mistral API key not configured (optional fallback)',
      };
    }

    log.success('Mistral API key configured');

    const skipGenerateTest = /^(1|true|yes)$/i.test(String(process.env.MISTRAL_HEALTHCHECK_SKIP_GENERATE || ''));
    if (skipGenerateTest) {
      log.info('Skipping Mistral generate test (MISTRAL_HEALTHCHECK_SKIP_GENERATE enabled)');
      return {
        status: 'success',
        component: 'Mistral AI',
        message: 'API key is configured (generate test skipped)',
        details: { configuredModel: getMistralModelName() },
      };
    }

    log.info('Testing Mistral model connection...');
    const text = await mistralGenerateText('Test connection. Respond with "OK".');
    if (text) {
      log.success('Mistral AI model is responsive');
      log.info(`  Model: ${getMistralModelName()}`);
      return {
        status: 'success',
        component: 'Mistral AI',
        message: 'AI model is ready',
        details: {
          model: getMistralModelName(),
          testResponse: text.substring(0, 50),
        },
      };
    }

    throw new Error('Empty response from Mistral');
  } catch (error: any) {
    log.error(`Mistral AI check failed: ${error.message}`);
    return {
      status: 'error',
      component: 'Mistral AI',
      message: `AI model unavailable: ${error.message}`,
    };
  }
}

/**
 * Check environment variables
 */
function checkEnvironment(): StartupCheckResult {
  log.info('Checking environment configuration...');
  
  const requiredEnvVars = ['DATABASE_URL'];
  
  const missingVars: string[] = [];
  const presentVars: string[] = [];
  
  for (const varName of requiredEnvVars) {
    if (process.env[varName]) {
      presentVars.push(varName);
    } else {
      missingVars.push(varName);
    }
  }

  // AI provider: require at least one key (Gemini or Mistral)
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasMistral = Boolean(process.env.MISTRAL_API_KEY);
  if (!hasGemini && !hasMistral) {
    missingVars.push('GEMINI_API_KEY or MISTRAL_API_KEY');
  } else {
    if (hasGemini) presentVars.push('GEMINI_API_KEY');
    if (hasMistral) presentVars.push('MISTRAL_API_KEY');
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
  log.section('🚀 EMOTION-AWARE LEARNING SYSTEM - STARTUP');
  console.log(`${colors.cyan}Starting system initialization...${colors.reset}`);
  console.log(`Time: ${new Date().toISOString()}\n`);
  
  const results: StartupCheckResult[] = [];
  
  // Environment check (synchronous)
  log.section('Environment Configuration');
  results.push(checkEnvironment());
  
  // Database check
  log.section('Database Connection');
  results.push(await checkDatabase());
  
  // Gemini AI check
  log.section('AI Model Initialization');
  results.push(await checkGeminiAI());

  // Mistral AI check (fallback)
  results.push(await checkMistralAI());
  
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
    log.error('System startup completed with errors!');
    log.error('Please fix the above errors before using the application.');
    console.log('\n');
  } else if (warningCount > 0) {
    console.log('\n');
    log.warning('System startup completed with warnings.');
    log.info('The application may work with reduced functionality.');
    console.log('\n');
  } else {
    console.log('\n');
    log.success('✨ All systems are GO! Application is ready to serve.');
    console.log('\n');
  }

  // Optional: pre-generate/refine materials once at startup so content is stable
  // for all users. This runs in the background and never blocks server start.
  kickOffMaterialPrecomputeOnStartup();
  
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
