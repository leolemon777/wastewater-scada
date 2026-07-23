import React, { useMemo } from 'react';
import * as THREE from 'three';
import { SCENE_VISUAL } from '../shared/sceneVisualDefaults';
import { Materials } from '../shared/Materials';
import { resolveSiteGroundSurfaceColor } from './siteGround';
import {
  SLUDGE_ACCESS_RAMP,
  SLUDGE_PLATFORM_DECK_Y,
  SLUDGE_RAMP_DECK_THICKNESS,
} from './sludgePlatformLayout';

/**
 * South-facing vehicle ramp: ground service road (y=0, +Z) → platform deck (y=0.5, −Z).
 * Geometry is anchored at the south toe so the slope meets road and deck flush.
 */
export const SludgePlatformAccessRamp3D: React.FC = () => {
  const { x, halfWidth, zGround, zPlatform } = SLUDGE_ACCESS_RAMP;
  const groundSurfaceColor = useMemo(
    () =>
      resolveSiteGroundSurfaceColor({
        isNight: SCENE_VISUAL.isNight,
        isRainy: SCENE_VISUAL.isRainy,
        isBrightPalette: SCENE_VISUAL.isBrightPalette,
      }),
    [],
  );
  const run = zGround - zPlatform;
  const rise = SLUDGE_PLATFORM_DECK_Y;
  const width = halfWidth * 2;
  // Driving surface south toe thickness — top face climbs from here to `rise`
  // at the north end, ending flush with the platform deck (no step up).
  const deckThickness = SLUDGE_RAMP_DECK_THICKNESS;

  const rampGeometry = useMemo(() => {
    const hw = width / 2;
    const geo = new THREE.BufferGeometry();
    // Local origin = south ground toe. +Z local = south; −Z local = north (platform).
    // Driving surface is flush with the road at the south toe (y=0) and flush
    // with the platform deck at the north end (y=rise). Solid wedge fill sits
    // flat on the ground so vehicles never intersect the concrete.
    const positions = new Float32Array([
      // Top driving deck (sloped) — south y=0, north y=rise
      -hw, 0, 0,
      hw, 0, 0,
      hw, rise, -run,
      -hw, rise, -run,
      // Solid wedge fill beneath deck (flat on ground)
      -hw, 0, 0,
      hw, 0, 0,
      hw, 0, -run,
      -hw, 0, -run,
    ]);
    const indices = [
      0, 1, 2, 0, 2, 3, // deck top
      4, 6, 5, 4, 7, 6, // bottom (degenerate at south knife-edge, fine)
      4, 5, 1, 4, 1, 0, // south face (zero-area knife edge)
      7, 3, 2, 7, 2, 6, // north face (vertical, full rise)
      4, 0, 3, 4, 3, 7, // west face
      5, 6, 2, 5, 2, 1, // east face
    ];
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [run, rise, width]);

  const approachLen = 2.6;

  return (
    <group position={[x, 0, zGround]}>
      {/* Main ramp wedge — concrete, flush with platform deck at north edge */}
      <mesh geometry={rampGeometry} receiveShadow castShadow>
        <primitive object={Materials.concrete} attach="material" />
      </mesh>

      {/* Ground approach pad tying ramp toe into the south asphalt road */}
      <mesh position={[0, 0.006, approachLen / 2]} receiveShadow>
        <boxGeometry args={[width + 0.4, 0.012, approachLen]} />
        <meshStandardMaterial color={groundSurfaceColor} roughness={0.88} metalness={0.02} />
      </mesh>

      {/* Side retaining walls */}
      {([-1, 1] as const).map((side) => (
        <mesh
          key={side}
          position={[side * (halfWidth + 0.05), rise / 2, -run / 2]}
          receiveShadow
          castShadow
        >
          <boxGeometry args={[0.12, rise + 0.06, run + 0.08]} />
          <meshStandardMaterial color="#94989C" roughness={0.82} />
        </mesh>
      ))}

      {/* Deck lip at platform junction — hides any sub-mm gap with the main slab */}
      <mesh position={[0, rise + deckThickness * 0.5, -run - 0.04]} receiveShadow>
        <boxGeometry args={[width, deckThickness * 0.9, 0.14]} />
        <meshStandardMaterial color="#A9ADA8" roughness={0.86} />
      </mesh>
    </group>
  );
};

/** Small notch in the south platform coping so the ramp reads as a deliberate opening. */
export const SludgePlatformRampOpening3D: React.FC = () => {
  const { x, halfWidth, zPlatform } = SLUDGE_ACCESS_RAMP;
  const width = halfWidth * 2 + 0.3;

  return (
    <mesh position={[x, SLUDGE_PLATFORM_DECK_Y + 0.02, zPlatform + 0.06]} receiveShadow>
      <boxGeometry args={[width, 0.08, 0.18]} />
      <meshStandardMaterial color="#94989C" roughness={0.88} />
    </mesh>
  );
};
