/**
 * Pump3D running vibration group (motorShakeRef) must wrap the motor body
 * only. Parts that share a rigid interface with static geometry — the motor
 * mounting feet (foot sole → skid/riser), the adapter bracket / lantern
 * spacer (motor DE flange → volute shaft housing) and the coupling guard
 * (spans motor drive-end ↔ volute) — must stay OUTSIDE the group.
 *
 * Putting any of them inside made the running tremor shear a visible gap
 * between those parts and their static mating surface every frame (the
 * "motor separated from its base" look).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PUMP_3D = path.join(ROOT, 'src/components/scene/equipment/Pump3D.tsx');
const text = fs.readFileSync(PUMP_3D, 'utf8').replace(/\r\n/g, '\n');

const issues = [];

// Match the opening tag as a prefix so the check survives attribute additions
// (e.g. userData={{ bakeExclude: true }}) without editing this script.
const openTag = '<group ref={motorShakeRef}';
const openIndex = text.indexOf(openTag);

if (openIndex === -1) {
  issues.push('Missing <group ref={motorShakeRef}> in Pump3D.tsx — running vibration group not found');
} else {
  // Stack-count nested <group>/</group> from the opening tag to its match.
  // R3F <group> is never self-closing, so every <group ...> pushes and every
  // </group> pops.
  let depth = 1;
  let i = openIndex + openTag.length;
  let closeIndex = -1;
  while (i < text.length) {
    if (text.startsWith('</group>', i)) {
      depth -= 1;
      if (depth === 0) { closeIndex = i; break; }
      i += 8;
    } else if (text.startsWith('<group', i) && /[\s>]/.test(text[i + 6] ?? '')) {
      depth += 1;
      i += 6;
    } else {
      i += 1;
    }
  }

  if (closeIndex === -1) {
    issues.push('motorShakeRef <group> has no matching </group> in Pump3D.tsx');
  } else {
    const block = text.slice(openIndex, closeIndex);

    // Rigidly-coupled parts that must NOT ride the running vibration group.
    const forbidden = [
      { label: 'motor mounting feet (foot soles must seat on the skid/riser)', needle: 'Motor mounting feet' },
      { label: 'motor adapter bracket / lantern spacer (rigid to volute shaft housing)', needle: 'adapter bracket' },
      { label: 'coupling guard (spans motor drive-end and volute)', needle: 'oupling guard' },
    ];
    for (const { label, needle } of forbidden) {
      if (block.includes(needle)) {
        issues.push(`motorShakeRef must not contain the ${label}; move it outside the running vibration group`);
      }
    }

    // Guard against the group being re-scoped to something empty / wrong: the
    // motor body itself must still be inside or the tremor no longer reads as
    // a running motor.
    if (!block.includes('Motor Assembly')) {
      issues.push('motorShakeRef no longer wraps the Motor Assembly; the running vibration group is mis-scoped');
    }
  }
}

if (issues.length > 0) {
  console.error('\nPump vibration rigidity issues:');
  for (const issue of issues) console.error(`- ${issue}`);
  process.exitCode = 1;
} else {
  console.log('Pump vibration rigidity: motorShakeRef wraps the motor body only; feet/adapter/coupling-guard stay rigid.');
}
