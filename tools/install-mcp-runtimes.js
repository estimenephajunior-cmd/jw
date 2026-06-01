const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const vendorDir = path.join(root, 'vendor', 'mcp');

const repos = [
  ['jw-mcp', 'https://github.com/advenimus/jw-mcp.git'],
  ['jw-org-mcp', 'https://github.com/Bjern/jw-org-mcp.git'],
];

fs.mkdirSync(vendorDir, { recursive: true });

for (const [name, url] of repos) {
  const target = path.join(vendorDir, name);
  if (fs.existsSync(target)) {
    run('git', ['-C', target, 'pull', '--ff-only']);
  } else {
    run('git', ['clone', '--depth', '1', url, target]);
  }
}

const jwDir = path.join(vendorDir, 'jw-mcp');
if (fs.existsSync(path.join(jwDir, 'package.json'))) {
  run('npm', ['install'], jwDir);
}

const jwOrgDir = path.join(vendorDir, 'jw-org-mcp');
if (fs.existsSync(path.join(jwOrgDir, 'pyproject.toml'))) {
  run('uv', ['sync'], jwOrgDir, { optional: true });
}

console.log('MCP runtimes are installed under vendor/mcp.');

function run(command, args, cwd = root, options = {}) {
  const candidates = resolveCommandCandidates(command);
  let result;

  for (const executable of candidates) {
    const isCmd = process.platform === 'win32' && /\.cmd$/i.test(executable);
    const spawnCommand = isCmd ? `"${executable}" ${args.map(quoteCmdArg).join(' ')}` : executable;
    result = spawnSync(spawnCommand, isCmd ? [] : args, {
      cwd,
      stdio: 'inherit',
      shell: isCmd,
    });
    if (result.error?.code === 'ENOENT' || result.error?.code === 'EINVAL') continue;
    break;
  }

  if (result?.error) {
    console.error(result.error.message);
  }

  if (result.status !== 0 && !options.optional) {
    process.exit(result.status || 1);
  }

  if (result.status !== 0 && options.optional) {
    console.warn(`Optional setup failed: ${command} ${args.join(' ')}`);
  }
}

function quoteCmdArg(value) {
  const text = String(value);
  if (!/[\s"&|<>^]/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
}

function resolveCommandCandidates(command) {
  if (process.platform !== 'win32') return [command];
  const where = spawnSync('where.exe', [command], { encoding: 'utf8' });
  const resolved = where.status === 0
    ? where.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : [];
  const cmdFiles = resolved.filter((line) => /\.cmd$/i.test(line));
  const executables = resolved.filter((line) => !/\.cmd$/i.test(line));
  return [...executables, ...cmdFiles, `${command}.exe`, `${command}.cmd`, command];
}
