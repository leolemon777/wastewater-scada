import React from 'react';
import * as THREE from 'three';

type Point3 = [number, number, number];

interface PipeElbowFitting3DProps {
  previous: Point3;
  corner: Point3;
  next: Point3;
  radius: number;
  color: string;
}

const zAxis = new THREE.Vector3(0, 0, 1);
/** Keep aligned with Pipe3D's visible fillet length. */
const BEND_TANGENT_OFFSET_MULTIPLIER = 2.6;

function rotationFromZ(direction: THREE.Vector3): [number, number, number] {
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    zAxis,
    direction.clone().normalize(),
  );
  const rotation = new THREE.Euler().setFromQuaternion(quaternion);
  return [rotation.x, rotation.y, rotation.z];
}

function ElbowEndCollar({
  position,
  direction,
  radius,
  color,
  showSeam,
}: {
  position: Point3;
  direction: THREE.Vector3;
  radius: number;
  color: string;
  showSeam: boolean;
}) {
  const collarLength = Math.max(radius * 0.72, 0.06);
  const collarRadius = radius * 1.14;
  const weldRadius = radius * 1.155;
  const weldTube = Math.max(radius * 0.045, 0.005);

  return (
    <group position={position} rotation={rotationFromZ(direction)}>
      {/* Cylinder is Y-aligned; rotate it so this sleeve follows local Z. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[collarRadius, collarRadius, collarLength, 28]} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.12} />
      </mesh>
      {showSeam && (
        <mesh position={[0, 0, collarLength / 2]}>
          <torusGeometry args={[weldRadius, weldTube, 8, 28]} />
          <meshStandardMaterial color="#87939C" roughness={0.48} metalness={0.5} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Visible fitting marks at the two tangent ends of a Pipe3D 90° fillet.
 * Pipe3D supplies the curved shell; these collars make the bend read as a
 * fabricated industrial elbow rather than a continuously bent soft hose.
 */
export const PipeElbowFitting3D: React.FC<PipeElbowFitting3DProps> = ({
  previous,
  corner,
  next,
  radius,
  color,
}) => {
  const previousPoint = new THREE.Vector3(...previous);
  const cornerPoint = new THREE.Vector3(...corner);
  const nextPoint = new THREE.Vector3(...next);
  const incoming = cornerPoint.clone().sub(previousPoint).normalize();
  const outgoing = nextPoint.clone().sub(cornerPoint).normalize();
  const offset = radius * BEND_TANGENT_OFFSET_MULTIPLIER;
  const bendStart = cornerPoint.clone().addScaledVector(incoming, -offset);
  const bendEnd = cornerPoint.clone().addScaledVector(outgoing, offset);

  return (
    <group userData={{ bakeExclude: true }}>
      <ElbowEndCollar
        position={bendStart.toArray() as Point3}
        direction={incoming}
        radius={radius}
        color={color}
        showSeam={false}
      />
      <ElbowEndCollar
        position={bendEnd.toArray() as Point3}
        direction={outgoing}
        radius={radius}
        color={color}
        showSeam={true}
      />
    </group>
  );
};
