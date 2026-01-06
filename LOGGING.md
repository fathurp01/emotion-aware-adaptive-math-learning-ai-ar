# 📝 Logging System Documentation

## Overview

Sistem logging yang komprehensif untuk tracking semua aktivitas, error, dan request dalam aplikasi.

## Types of Logging

### 1. Startup Logging
✅ **Otomatis berjalan saat aplikasi start**

Lihat [STARTUP_LOGGING.md](STARTUP_LOGGING.md) untuk detail lengkap.

Checks yang dilakukan:
- Database connection
- AI model availability
- Environment variables
- TensorFlow.js initialization
- Next.js configuration

### 2. Error Logging
✅ **Centralized error tracking**

File: `lib/logger.ts`

#### Error Types & Severity

**Error Types:**
- `DATABASE` - Database connection/query errors
- `AI` - Gemini AI/TensorFlow errors
- `VALIDATION` - Input validation errors
- `AUTHENTICATION` - Login/auth errors
- `SYSTEM` - Critical system errors
- `UNKNOWN` - Unclassified errors

**Severity Levels:**
- `LOW` - Minor issues, doesn't affect functionality
- `MEDIUM` - Noticeable issues, partial functionality affected
- `HIGH` - Serious issues, major functionality affected
- `CRITICAL` - System-breaking issues

#### Usage Example

```typescript
import { errorLogger } from '@/lib/logger';

// Log database error
try {
  await prisma.user.findUnique({ where: { id: userId } });
} catch (error) {
  errorLogger.database(
    'Failed to fetch user',
    error as Error,
    { userId },
    userId
  );
}

// Log AI error
try {
  const result = await generateQuiz(...);
} catch (error) {
  errorLogger.ai(
    'Quiz generation failed',
    error as Error,
    { materialId, emotion }
  );
}

// Log validation error
errorLogger.validation(
  'Invalid input data',
  error,
  { field: 'email', value: data.email }
);

// Log authentication error
errorLogger.auth(
  'Login failed',
  error,
  { username, ip: request.ip }
);

// Log system error
errorLogger.system(
  'Server crash',
  error,
  { uptime: process.uptime() }
);
```

### 3. Request Logging
✅ **HTTP request/response tracking**

Tracks:
- HTTP method
- Request path
- Response status code
- Response time (ms)

#### Usage Example

```typescript
import { logRequest } from '@/lib/logger';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // ... your logic
    
    const duration = Date.now() - startTime;
    logRequest('POST', '/api/quiz/generate', duration, 200);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    logRequest('POST', '/api/quiz/generate', duration, 500);
    
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

Console output:
```
[POST] /api/quiz/generate 200 (156ms)
[GET] /api/student/chapters 200 (23ms)
[POST] /api/quiz/generate 500 (89ms)
```

### 4. Health Check API
✅ **HTTP endpoint for system monitoring**

**Endpoint:** `GET /api/health`

Returns JSON with current system status.

#### Response Format

```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy',
  timestamp: string,
  uptime: number,  // in seconds
  checks: {
    database: {
      status: 'ok' | 'error',
      message?: string,
      responseTime?: number  // in ms
    },
    ai: {
      status: 'ok' | 'error',
      message?: string,
      model?: string
    },
    environment: {
      status: 'ok' | 'warning',
      missingVars?: string[]
    }
  }
}
```

#### Status Codes
- `200` - System healthy or degraded (partial functionality)
- `503` - System unhealthy (critical failure)

#### Usage Examples

**Using curl:**
```bash
curl http://localhost:3000/api/health
```

**Using fetch:**
```javascript
const response = await fetch('/api/health');
const health = await response.json();

if (health.status === 'healthy') {
  console.log('All systems operational');
}
```

**Load Balancer Config (nginx):**
```nginx
upstream backend {
  server app1:3000;
  server app2:3000;
  server app3:3000;
}

server {
  location / {
    proxy_pass http://backend;
    health_check uri=/api/health interval=10s;
  }
}
```

## Log Output Format

### Color Coding

Terminal logs use ANSI colors for easy reading:
- 🟢 **Green (✓)** - Success
- 🔵 **Cyan (ℹ)** - Information
- 🟡 **Yellow (⚠)** - Warning
- 🔴 **Red (✗)** - Error
- 🟣 **Magenta ([METHOD])** - HTTP request

### Example Output

```
═══ 🚀 EMOTION-AWARE LEARNING SYSTEM - STARTUP ═══

✓ Database connected successfully
ℹ   Users: 5 | Materials: 8 | Quizzes: 24

✓ Gemini AI model is responsive
ℹ   Model: gemini-1.5-flash

✨ All systems are GO!

[POST] /api/quiz/generate 200 (156ms)
[GET] /api/student/material/abc123 200 (23ms)
⚠ [MEDIUM] AI: Rate limit warning
✗ [HIGH] DATABASE: Connection timeout
```

## Configuration

### Environment Variables

```env
# Logging Configuration
NODE_ENV=development              # Enable verbose logging in dev
ENABLE_ERROR_DB_LOGGING=false     # Save errors to database (production)
```

### Enable/Disable Features

Edit `lib/logger.ts` and `lib/startup.ts`:

```typescript
// Disable certain startup checks
// Comment out in runStartupChecks():
// results.push(await checkTensorFlow());

// Change log level
const log = {
  info: (message: string) => {
    if (process.env.LOG_LEVEL !== 'silent') {
      console.log(message);
    }
  },
  // ...
};
```

## Integration with External Services

### Sentry Integration

```typescript
// lib/logger.ts
import * as Sentry from '@sentry/nextjs';

export async function logError(...) {
  // ... existing code
  
  // Send to Sentry in production
  if (process.env.NODE_ENV === 'production') {
    Sentry.captureException(error, {
      tags: { type, severity },
      extra: context,
    });
  }
}
```

### Datadog Integration

```typescript
// lib/logger.ts
import { datadogLogs } from '@datadog/browser-logs';

export async function logError(...) {
  // ... existing code
  
  datadogLogs.logger.error(message, {
    error,
    context,
    severity,
  });
}
```

### LogRocket Integration

```typescript
// lib/logger.ts
import LogRocket from 'logrocket';

export async function logError(...) {
  // ... existing code
  
  LogRocket.captureException(error, {
    tags: { type, severity },
    extra: context,
  });
}
```

## Best Practices

### 1. Always Log Errors
```typescript
try {
  // risky operation
} catch (error) {
  // ✅ DO: Log with context
  errorLogger.database('Failed to save', error, { userId, data });
  
  // ❌ DON'T: Silent failure
  return null;
}
```

### 2. Include Context
```typescript
// ✅ DO: Rich context
errorLogger.ai('Quiz generation failed', error, {
  materialId,
  emotion,
  learningStyle,
  attemptNumber: 3,
});

// ❌ DON'T: No context
errorLogger.ai('Failed', error);
```

### 3. Use Appropriate Severity
```typescript
// ✅ DO: Match severity to impact
errorLogger.validation('Invalid email', error);  // LOW
errorLogger.system('Server out of memory', error);  // CRITICAL

// ❌ DON'T: Everything is critical
```

### 4. Log Request Metrics
```typescript
// ✅ DO: Track performance
const startTime = Date.now();
// ... process request
logRequest('POST', path, Date.now() - startTime, 200);

// Helps identify slow endpoints
```

### 5. Don't Log Sensitive Data
```typescript
// ❌ DON'T: Log passwords, tokens, etc.
errorLogger.auth('Login failed', error, {
  password: user.password,  // NEVER!
  apiKey: process.env.API_KEY,  // NEVER!
});

// ✅ DO: Log safe identifiers
errorLogger.auth('Login failed', error, {
  userId: user.id,
  email: user.email,
  ip: request.ip,
});
```

## Monitoring & Alerts

### Automated Monitoring

Set up cron job to check health:
```bash
# Check every 5 minutes
*/5 * * * * curl http://localhost:3000/api/health || mail -s "App Down" admin@example.com
```

### Uptime Robot Integration

1. Create HTTP monitor: `https://yourdomain.com/api/health`
2. Set check interval: 5 minutes
3. Configure alerts: Email, SMS, Slack

### Custom Alerts

```typescript
// lib/alerts.ts
export async function sendAlert(severity: string, message: string) {
  if (severity === 'CRITICAL') {
    // Send to PagerDuty, Slack, etc.
    await fetch('https://hooks.slack.com/...', {
      method: 'POST',
      body: JSON.stringify({
        text: `🚨 CRITICAL: ${message}`,
      }),
    });
  }
}
```

## Performance Impact

### Startup Checks
- Time: ~2-5 seconds
- Impact: Only during server start
- Can be disabled for faster dev reload

### Request Logging
- Overhead: <1ms per request
- Memory: Minimal (console only)
- Can be disabled in production if needed

### Error Logging
- Overhead: Negligible
- Memory: No accumulation (streams to stdout)

## Troubleshooting

### Logs Not Showing
1. Check `NODE_ENV` is set
2. Verify console isn't filtered
3. Check if logging was disabled

### Health Check Returns 503
1. Check database connection
2. Verify GEMINI_API_KEY exists
3. Check all required env vars

### Too Many Logs
1. Set `LOG_LEVEL=error` to reduce noise
2. Disable request logging in production
3. Filter specific log types

## Future Enhancements

- [ ] Log aggregation dashboard
- [ ] Real-time log streaming
- [ ] Automatic error recovery
- [ ] ML-powered anomaly detection
- [ ] Performance profiling integration
- [ ] Custom log retention policies

## Related Documentation

- [STARTUP_LOGGING.md](STARTUP_LOGGING.md) - Startup checks detail
- [TESTING.md](TESTING.md) - Testing with logging
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production logging setup
