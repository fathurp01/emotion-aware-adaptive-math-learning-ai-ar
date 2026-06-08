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

import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(request: NextRequest) {
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

  const userAgent = request.headers.get('user-agent') || '';
  const accept = request.headers.get('accept') || '';
  const isPrometheus = userAgent.includes('Prometheus') || accept.includes('application/openmetrics-text') || accept.includes('text/plain');

  if (isPrometheus) {
    const systemUp = response.status === 'unhealthy' ? 0 : 1;
    const dbConnected = response.checks.database.status === 'ok' ? 1 : 0;
    const aiConnected = response.checks.ai.status === 'ok' ? 1 : 0;
    const dbResponseTime = response.checks.database.responseTime || 0;
    const uptime = response.uptime;

    const metricsText = [
      '# HELP system_up Status of the system (1 = healthy/degraded, 0 = unhealthy)',
      '# TYPE system_up gauge',
      `system_up ${systemUp}`,
      '# HELP database_connected Status of the database connection (1 = connected, 0 = error)',
      '# TYPE database_connected gauge',
      `database_connected ${dbConnected}`,
      '# HELP database_response_time_ms Database query response time in milliseconds',
      '# TYPE database_response_time_ms gauge',
      `database_response_time_ms ${dbResponseTime}`,
      '# HELP ai_connected Status of the AI provider connection (1 = connected, 0 = error)',
      '# TYPE ai_connected gauge',
      `ai_connected ${aiConnected}`,
      '# HELP system_uptime_seconds System uptime in seconds',
      '# TYPE system_uptime_seconds counter',
      `system_uptime_seconds ${uptime}`,
    ].join('\n') + '\n';

    return new Response(metricsText, {
      status: httpStatus,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    });
  }

  return NextResponse.json(response, { status: httpStatus });
}
