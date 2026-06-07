/* eslint-disable no-console */

const fs = require('fs');

function sleep(ms) {
  // Synchronous sleep without spawning a new process.
  // eslint-disable-next-line no-undef
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function rmWithRetries(path, opts) {
  const retries = Number(process.env.CLEAN_RETRIES ?? 8);
  const delayMs = Number(process.env.CLEAN_RETRY_DELAY_MS ?? 150);

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      fs.rmSync(path, opts);
      return true;
    } catch (err) {
      const code = err && typeof err === 'object' ? err.code : undefined;
      const isLast = attempt === retries;

      // Common on Windows if a process/AV locks a file (e.g., .next/trace).
      if (!isLast && (code === 'EPERM' || code === 'EBUSY' || code === 'EACCES')) {
        sleep(delayMs);
        continue;
      }

      console.warn(`[clean] Warning: failed to remove ${path} (${code ?? 'unknown'}).`);
      console.warn('[clean] If this persists, stop `next dev`, close editors using `.next`, or exclude the project from antivirus, then retry.');
      return false;
    }
  }

  return false;
}

rmWithRetries('.next', { recursive: true, force: true });
rmWithRetries('.turbo', { recursive: true, force: true });
