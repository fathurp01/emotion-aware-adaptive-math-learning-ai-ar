/**
 * Health Check API Endpoint
 * 
 * GET /api/health
 * 
 * Returns the current system health status including:
 * - Database connectivity
 * - AI model availability
 * - System uptime
 * - Environment configuration
 * 
 * Useful for:
 * - Load balancer health checks
 * - Monitoring systems
 * - Status page integrations
 * - CI/CD verification
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isGeminiConfigured } from '@/lib/gemini';
import { isNvidiaConfigured } from '@/lib/nvidia';
import { isMistralConfigured } from '@/lib/mistral';

export const dynamic = 'force-dynamic';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'ok' | 'error';
      message?: string;
      responseTime?: number;
    };
    ai: {
      status: 'ok' | 'error';
      message?: string;
      model?: string;
    };
    environment: {
      status: 'ok' | 'warning';
      missingVars?: string[];
    };
  };
}

export async function GET() {
  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: { status: 'ok' },
      ai: { status: 'ok' },
      environment: { status: 'ok' },
    },
  };

  // Check Database
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbTime = Date.now() - dbStart;
    
    response.checks.database = {
      status: 'ok',
      message: 'Connected',
      responseTime: dbTime,
    };
  } catch (error: any) {
    response.checks.database = {
      status: 'error',
      message: error.message,
    };
    response.status = 'unhealthy';
  }

  // Check AI Model
  try {
    const hasGemini = isGeminiConfigured();
    const hasNvidia = isNvidiaConfigured();
    const hasMistral = isMistralConfigured();

    if (!hasGemini && !hasNvidia && !hasMistral) {
      throw new Error('No AI provider API key configured');
    }

    let provider = '';
    let model = '';

    if (hasGemini) {
      provider = 'Gemini';
      model = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();
    } else if (hasNvidia) {
      provider = 'NVIDIA';
      model = (process.env.NVIDIA_MODEL || 'meta/llama-3.1-8b-instruct').trim();
    } else {
      provider = 'Mistral';
      model = (process.env.MISTRAL_MODEL || 'mistral-small-latest').trim();
    }

    response.checks.ai = {
      status: 'ok',
      message: `Active provider: ${provider}`,
      model: model,
    };
  } catch (error: any) {
    response.checks.ai = {
      status: 'error',
      message: error.message,
    };
    response.status = response.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // Check Environment Variables
  const requiredVars = ['DATABASE_URL'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  // At least one AI key must be present and not placeholder
  const hasGemini = isGeminiConfigured();
  const hasNvidia = isNvidiaConfigured();
  const hasMistral = isMistralConfigured();
  if (!hasGemini && !hasNvidia && !hasMistral) {
    missingVars.push('GEMINI_API_KEY, NVIDIA_API_KEY, or MISTRAL_API_KEY');
  }
  
  if (missingVars.length > 0) {
    response.checks.environment = {
      status: 'warning',
      missingVars,
    };
    response.status = response.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // Return appropriate HTTP status code
  const httpStatus = response.status === 'healthy' ? 200 : 
                     response.status === 'degraded' ? 200 : 503;

  return NextResponse.json(response, { status: httpStatus });
}
