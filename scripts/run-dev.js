/* eslint-disable no-console */

const { spawn } = require('child_process');
const path = require('path');

function getNodeMajor() {
  const raw = String(process.versions.node || '0');
  const major = Number.parseInt(raw.split('.')[0] || '0', 10);
  return Number.isFinite(major) ? major : 0;
}

const isWin = process.platform === 'win32';
const nodeMajor = getNodeMajor();

// Windows + newer Node versions have been observed to hit intermittent filesystem errors
// like: UNKNOWN ... open .next\\static\\chunks\\app\\layout.js
// Turbopack tends to avoid this class of issues.
const useTurbo =
  String(process.env.NEXT_USE_TURBO || '').trim() === '1' || (isWin && nodeMajor >= 21);

let nextCli;
try {
  nextCli = require.resolve('next/dist/bin/next');
} catch {
  // Fallback (should not happen with a standard Next install)
  nextCli = path.join(__dirname, '..', 'node_modules', 'next', 'dist', 'bin', 'next');
}

const args = ['dev'];
if (useTurbo) args.push('--turbo');

// Allow binding dev server to LAN for testing on phone.
// Usage: node scripts/run-dev.js --host 0.0.0.0 --port 3000
function readArgValue(flag) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

const host =
  readArgValue('--host') ||
  readArgValue('--hostname') ||
  process.env.DEV_HOST ||
  process.env.NEXT_DEV_HOST ||
  process.env.NEXT_HOSTNAME;

const port =
  readArgValue('--port') ||
  process.env.PORT ||
  process.env.NEXT_DEV_PORT;

if (host) args.push('--hostname', String(host));
if (port) args.push('--port', String(port));

console.log(
  `[dev] Starting Next.js (${useTurbo ? 'turbo' : 'webpack'}) on Node ${process.versions.node}` +
    (host ? ` (host=${host})` : '') +
    (port ? ` (port=${port})` : '')
);

let child;
child = spawn(process.execPath, [nextCli, ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(typeof code === 'number' ? code : 0);
});
