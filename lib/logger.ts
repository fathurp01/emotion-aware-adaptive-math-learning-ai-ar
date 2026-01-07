/**
 * Centralized Error Logging System
 * 
 * This module provides comprehensive error logging and tracking.
 * All errors in the application should be logged through this system.
 */


export interface ErrorLog {
  id?: number;
  type: 'DATABASE' | 'AI' | 'VALIDATION' | 'AUTHENTICATION' | 'SYSTEM' | 'UNKNOWN';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userId?: number;
  timestamp: Date;
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
};

/**
 * Log error to console with formatting
 */
function logToConsole(error: ErrorLog) {
  const severityColor = error.severity === 'CRITICAL' || error.severity === 'HIGH' 
    ? colors.red 
    : colors.yellow;
  
  console.error(
    `${severityColor}[${error.severity}] ${error.type}${colors.reset}:`,
    error.message
  );
  
  if (error.context) {
    console.error('Context:', JSON.stringify(error.context, null, 2));
  }
  
  if (error.stack && process.env.NODE_ENV === 'development') {
    console.error('Stack:', error.stack);
  }
}

/**
 * Log error to database (optional, for production monitoring)
 */
async function logToDatabase(_error: ErrorLog): Promise<void> {
  // Only log to database in production or if explicitly enabled
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_ERROR_DB_LOGGING === 'true') {
    try {
      // You can create an ErrorLog table in your schema if needed
      // For now, we'll skip database logging
      // await prisma.errorLog.create({ data: error });
    } catch (dbError) {
      console.error('Failed to log error to database:', dbError);
    }
  }
}

/**
 * Main error logging function
 */
export async function logError(
  type: ErrorLog['type'],
  severity: ErrorLog['severity'],
  message: string,
  error?: Error,
  context?: Record<string, any>,
  userId?: number
): Promise<void> {
  const errorLog: ErrorLog = {
    type,
    severity,
    message,
    stack: error?.stack,
    context,
    userId,
    timestamp: new Date(),
  };

  // Always log to console
  logToConsole(errorLog);

  // Log to database if configured
  await logToDatabase(errorLog);

  // In production, you might want to send to external services
  // like Sentry, LogRocket, or Datadog
  if (process.env.NODE_ENV === 'production') {
    // await sendToExternalService(errorLog);
  }
}

/**
 * Convenience functions for different error types
 */
export const errorLogger = {
  database: (message: string, error?: Error, context?: any, userId?: number) =>
    logError('DATABASE', 'HIGH', message, error, context, userId),

  ai: (message: string, error?: Error, context?: any, userId?: number) =>
    logError('AI', 'MEDIUM', message, error, context, userId),

  validation: (message: string, error?: Error, context?: any, userId?: number) =>
    logError('VALIDATION', 'LOW', message, error, context, userId),

  auth: (message: string, error?: Error, context?: any, userId?: number) =>
    logError('AUTHENTICATION', 'HIGH', message, error, context, userId),

  system: (message: string, error?: Error, context?: any, userId?: number) =>
    logError('SYSTEM', 'CRITICAL', message, error, context, userId),

  unknown: (message: string, error?: Error, context?: any, userId?: number) =>
    logError('UNKNOWN', 'MEDIUM', message, error, context, userId),
};

/**
 * Request logging middleware helper
 */
export function logRequest(
  method: string,
  path: string,
  duration: number,
  statusCode: number
) {
  const statusColor = statusCode >= 500 ? colors.red :
                     statusCode >= 400 ? colors.yellow :
                     colors.reset;
  
  console.log(
    `${colors.magenta}[${method}]${colors.reset}`,
    path,
    `${statusColor}${statusCode}${colors.reset}`,
    `(${duration}ms)`
  );
}
