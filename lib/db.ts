/**
 * Prisma Client Singleton
 * 
 * This ensures we have a single instance of PrismaClient across the application
 * to prevent connection pool exhaustion in development due to hot reloading.
 * 
 * In production: Creates one instance
 * In development: Reuses the same instance across hot reloads
 */

import { PrismaClient } from '@prisma/client';

// Declare a global type to store PrismaClient in development
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Create a singleton instance
export const prisma =
  global.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
    errorFormat: 'pretty',
  });

// In development, store the instance globally to prevent multiple instances
if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Log successful connection (only in development)
if (process.env.NODE_ENV === 'development') {
  prisma.$connect().then(() => {
    console.log('🔌 Prisma Client connected to database');
  }).catch((error) => {
    console.error('❌ Failed to connect to database:', error.message);
  });
}

// Export the Prisma client as default for convenience
export default prisma;
