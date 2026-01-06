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
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const configuredModel = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();

    response.checks.ai = {
      status: 'ok',
      message: 'API key configured',
      model: configuredModel,
    };
  } catch (error: any) {
    response.checks.ai = {
      status: 'error',
      message: error.message,
    };
    response.status = response.status === 'unhealthy' ? 'unhealthy' : 'degraded';
  }

  // Check Environment Variables
  const requiredVars = ['DATABASE_URL', 'GEMINI_API_KEY'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
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
