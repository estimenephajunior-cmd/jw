const { spawn } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');
const env = {
  ...process.env,
  EXPO_NO_TELEMETRY: '1',
  EXPO_NO_DEPENDENCY_VALIDATION: '1',
  NODE_OPTIONS: [process.env.NODE_OPTIONS, '--use-system-ca'].filter(Boolean).join(' '),
};

const proxy = spawn(process.execPath, [path.join(root, 'tools', 'local-proxy.js')], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true,
});

const expo = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['expo', 'start', '--web', '--port', '3000'], {
  cwd: root,
  env,
  stdio: 'inherit',
  windowsHide: true,
  shell: process.platform === 'win32',
});

function shutdown(code = 0) {
  if (!proxy.killed) proxy.kill();
  if (!expo.killed) expo.kill();
  process.exit(code);
}

proxy.on('exit', (code) => {
  if (code && code !== 0) {
    console.warn('Local proxy process exited; continuing Expo. If WOL requests fail, run `npm run proxy`.');
  }
});

expo.on('exit', (code) => {
  shutdown(code || 0);
});

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
