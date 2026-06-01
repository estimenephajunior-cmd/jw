const { spawn } = require('child_process');

const path = require('path');



require('./load-env').loadEnvFile();



const root = path.resolve(__dirname, '..');

const expoPort = process.env.EXPO_WEB_PORT || '3005';



const env = {

  ...process.env,

  CI: '1',

  EXPO_NO_TELEMETRY: '1',

  EXPO_NO_DEPENDENCY_VALIDATION: '1',

  EXPO_PUBLIC_MCP_GATEWAY_URL: process.env.EXPO_PUBLIC_MCP_GATEWAY_URL || 'http://localhost:8788',

  NODE_OPTIONS: [process.env.NODE_OPTIONS, '--use-system-ca'].filter(Boolean).join(' '),

};



const proxy = spawn(process.execPath, [path.join(root, 'tools', 'local-proxy.js')], {

  cwd: root,

  env,

  stdio: 'inherit',

  windowsHide: true,

});



const mcpGateway = spawn(process.execPath, [path.join(root, 'tools', 'mcp-gateway-server.js')], {

  cwd: root,

  env: {

    ...env,

    MCP_GATEWAY_PORT: process.env.MCP_GATEWAY_PORT || '8788',

  },

  stdio: 'inherit',

  windowsHide: true,

});



const expo = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['expo', 'start', '--web', '--port', expoPort], {

  cwd: root,

  env,

  stdio: 'inherit',

  windowsHide: true,

  shell: process.platform === 'win32',

});



function shutdown(code = 0) {

  if (!proxy.killed) proxy.kill();

  if (!mcpGateway.killed) mcpGateway.kill();

  if (!expo.killed) expo.kill();

  process.exit(code);

}



proxy.on('exit', (code) => {

  if (code && code !== 0) {

    console.warn('Local proxy process exited; continuing Expo. If WOL requests fail, run `npm run proxy`.');

  }

});



mcpGateway.on('exit', (code) => {

  if (code && code !== 0) {

    console.warn('MCP gateway exited; continuing Expo. If MCP requests fail, run `npm run start:mcp-gateway`.');

  }

});



expo.on('exit', (code) => {

  if (code && code !== 0) {

    console.warn(`Expo exited (${code}). Proxies still running. Open http://localhost:${expoPort} after fixing port conflicts.`);

  }

});



process.on('SIGINT', () => shutdown(0));

process.on('SIGTERM', () => shutdown(0));

