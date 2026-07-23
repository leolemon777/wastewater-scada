import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';

/**
 * Static Meshy inspector mesh preview (no skeleton / no walk animation).
 * Asset: public/inspector-preview.glb
 */
const MODEL_URL = `${import.meta.env.BASE_URL}inspector-preview.glb`;

interface InspectorPreview3DProps {
  /** World position for the feet (y is ground contact). */
  position?: [number, number, number];
  /** Y-axis rotation in radians. */
  rotationY?: number;
  /** Uniform scale (model is ~1.9 m tall in source units). */
  scale?: number;
}

export const InspectorPreview3D: React.FC<InspectorPreview3DProps> = ({
  // Open yard east of the patrol-office door approach — easy to find in the overview camera.
  position = [-50, 0, -16],
  rotationY = Math.PI * 0.35,
  scale = 1,
}) => {
  const { scene } = useGLTF(MODEL_URL);

  const rooted = useMemo(() => {
    const clone = scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const center = box.getCenter(new THREE.Vector3());

    // Center XZ on the group origin; lift so minY sits on the ground plane.
    clone.position.x -= center.x;
    clone.position.z -= center.z;
    clone.position.y -= box.min.y;

    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
    });

    return clone;
  }, [scene]);

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
      userData={{ bakeExclude: true }}
    >
      <primitive object={rooted} />
    </group>
  );
};

useGLTF.preload(MODEL_URL);
