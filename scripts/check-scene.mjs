import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const checksDirectory = join(dirname(fileURLToPath(import.meta.url)), 'checks', 'scene');
const checks = readdirSync(checksDirectory)
  .filter((file) => file.startsWith('check-') && file.endsWith('.mjs'))
  .sort();

for (const check of checks) {
  console.log(`\n[scene-check] ${check}`);
  const result = spawnSync(process.execPath, [join(checksDirectory, check)], {
    cwd: process.cwd(),
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\nAll ${checks.length} scene checks passed.`);
