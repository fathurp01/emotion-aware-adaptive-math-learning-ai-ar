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

console.log(`[dev] Starting Next.js (${useTurbo ? 'turbo' : 'webpack'}) on Node ${process.versions.node}`);

let child;
child = spawn(process.execPath, [nextCli, ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(typeof code === 'number' ? code : 0);
});
