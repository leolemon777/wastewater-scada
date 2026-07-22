import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHECK_GROUPS = {
  state: [
    'state/check-equipment-coverage.mjs',
    'state/check-zustand-selectors.mjs',
  ],
  pipes: [
    'pipes/check-pipe-endpoints.mjs',
    'pipes/check-pipe-visual-semantics.mjs',
    'pipes/check-equipment-endpoint-fittings.mjs',
    'pipes/check-sealed-terminal-pairing.mjs',
    'pipes/check-pump-pipe-geometry.mjs',
    'pipes/check-pump-port-alignment.mjs',
    'pipes/check-pump-port-proportions.mjs',
    'pipes/check-chemical-metering-ports.mjs',
    'pipes/check-pipe-physical-connections.mjs',
    'pipes/check-no-duplicate-pipe-fittings.mjs',
    'pipes/check-pipe-fitting-proportions.mjs',
    'pipes/check-small-pipe-terminal-proportions.mjs',
    'pipes/check-pipe-color-distinction.mjs',
  ],
  scene: [
    'scene/check-no-3d-level-scale.mjs',
    'scene/check-no-holographic-scanner.mjs',
    'scene/check-scene-render-quality.mjs',
  ],
  ui: [
    'ui/check-overlay-density.mjs',
    'ui/check-no-decorative-css-gradients.mjs',
    'ui/check-html-overlay-depth.mjs',
  ],
};

const checksRoot = fileURLToPath(new URL('./checks/', import.meta.url));

for (const [group, checks] of Object.entries(CHECK_GROUPS)) {
  console.log(`\n=== ${group.toUpperCase()} CHECKS ===`);

  for (const check of checks) {
    const result = spawnSync(process.execPath, [path.join(checksRoot, check)], {
      cwd: process.cwd(),
      stdio: 'inherit',
    });

    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
}

console.log(`\nAll ${Object.values(CHECK_GROUPS).flat().length} scene checks passed.`);
