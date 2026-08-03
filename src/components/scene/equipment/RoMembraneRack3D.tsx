import React from 'react';
import { useCursor } from '@react-three/drei';
import { FloatingPoolLabel3D } from '../shared/FloatingPoolLabel3D';
import { StatusLight3D } from '../shared/IndustrialParts';
import { useScadaStore, type RoUnitData } from '../../../store/useScadaStore';

interface RoMembraneRack3DProps {
  id: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}

const SKID_L = 2.5; // along local X
const SKID_W = 0.72; // along local Z
const MEMBRANE_R = 0.13;
const MEMBRANE_LEN = 2.15;
const MEMBRANE_Y = [0.58, 1.24];

/**
 * RO 膜组 (reverse-osmosis membrane rack) — skid-mounted pair of horizontal
 * FRP pressure vessels with stainless end caps and clamp bands, matching the
 * two stacked housings per stage on the HMI. A frame-post status lamp follows
 * the unit runStatus; pressure / conductivity transmitters are reserved.
 */
export const RoMembraneRack3D: React.FC<RoMembraneRack3DProps> = ({
  id,
  position,
  rotation = [0, 0, 0],
}) => {
  const unit = useScadaStore((state) => state.equipments[id] as RoUnitData | undefined);
  const isSelected = useScadaStore((state) => state.selectedEquipmentId === id);
  const setSelectedEquipment = useScadaStore((state) => state.setSelectedEquipment);
  const [hovered, setHovered] = React.useState(false);

  useCursor(hovered, 'pointer', 'auto');
  if (!unit) return null;

  const alarm = unit.alarmState !== 'none';
  const running = unit.runStatus === 'running';
  const status = unit.runStatus === 'fault' ? 'fault' : running ? 'running' : 'stopped';
  const frameColor = alarm ? '#A98A8A' : isSelected ? '#9AA8B4' : '#828D97';
  const shellColor = alarm ? '#E8CFC9' : isSelected ? '#F4F8FA' : '#E9EEF1';
  const capColor = '#9AA4AD';
  const bandColor = '#6E7881';

  return (
    <group position={position} rotation={rotation} userData={{ bakeExclude: true }}>
      <mesh
        visible={false}
        onClick={(e) => { e.stopPropagation(); setSelectedEquipment(id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
        position={[0, 0.8, 0]}
      >
        <boxGeometry args={[SKID_L + 0.5, 1.8, SKID_W + 0.5]} />
      </mesh>

      {/* Skid frame: 4 posts + longitudinal/end beams + foot pads */}
      {[
        [-SKID_L / 2 + 0.08, -SKID_W / 2 + 0.07],
        [-SKID_L / 2 + 0.08, SKID_W / 2 - 0.07],
        [SKID_L / 2 - 0.08, -SKID_W / 2 + 0.07],
        [SKID_L / 2 - 0.08, SKID_W / 2 - 0.07],
      ].map(([x, z], i) => (
        <group key={`post-${i}`} position={[x, 0, z]}>
          <mesh castShadow receiveShadow position={[0, 0.74, 0]}>
            <boxGeometry args={[0.07, 1.48, 0.07]} />
            <meshStandardMaterial color={frameColor} roughness={0.46} metalness={0.62} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, 0.025, 0]}>
            <boxGeometry args={[0.14, 0.05, 0.14]} />
            <meshStandardMaterial color="#5F6972" roughness={0.55} metalness={0.55} />
          </mesh>
        </group>
      ))}
      {[0.34, 0.92, 1.44].map((y, i) => (
        <React.Fragment key={`beam-${i}`}>
          <mesh castShadow receiveShadow position={[0, y, -SKID_W / 2 + 0.07]}>
            <boxGeometry args={[SKID_L - 0.1, 0.06, 0.05]} />
            <meshStandardMaterial color={frameColor} roughness={0.46} metalness={0.62} />
          </mesh>
          <mesh castShadow receiveShadow position={[0, y, SKID_W / 2 - 0.07]}>
            <boxGeometry args={[SKID_L - 0.1, 0.06, 0.05]} />
            <meshStandardMaterial color={frameColor} roughness={0.46} metalness={0.62} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Two horizontal membrane housings on saddles */}
      {MEMBRANE_Y.map((y, mi) => (
        <group key={`membrane-${mi}`} position={[0, y, 0]}>
          {/* Saddle supports (ride the skid beams) */}
          {[-SKID_L / 4, SKID_L / 4].map((x, si) => (
            <mesh key={`saddle-${si}`} castShadow receiveShadow position={[x, -MEMBRANE_R - 0.045, 0]}>
              <boxGeometry args={[0.1, 0.09, SKID_W - 0.18]} />
              <meshStandardMaterial color={frameColor} roughness={0.46} metalness={0.62} />
            </mesh>
          ))}
          {/* FRP pressure vessel */}
          <mesh castShadow receiveShadow rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[MEMBRANE_R, MEMBRANE_R, MEMBRANE_LEN, 28]} />
            <meshStandardMaterial color={shellColor} roughness={0.38} metalness={0.06} />
          </mesh>
          {/* Stainless end caps with centre permeate/concentrate ports */}
          {[-1, 1].map((side) => (
            <group key={`cap-${side}`} position={[(MEMBRANE_LEN / 2) * side, 0, 0]}>
              <mesh castShadow receiveShadow rotation={[0, 0, (Math.PI / 2) * side]}>
                <cylinderGeometry args={[MEMBRANE_R * 0.94, MEMBRANE_R * 1.01, 0.09, 28]} />
                <meshStandardMaterial color={capColor} roughness={0.36} metalness={0.7} />
              </mesh>
              <mesh castShadow receiveShadow position={[0.07 * side, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.038, 0.038, 0.07, 12]} />
                <meshStandardMaterial color={bandColor} roughness={0.4} metalness={0.72} />
              </mesh>
            </group>
          ))}
          {/* Clamp bands (3 per housing) */}
          {[-MEMBRANE_LEN / 3, 0, MEMBRANE_LEN / 3].map((x, bi) => (
            <mesh key={`band-${bi}`} castShadow receiveShadow position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <torusGeometry args={[MEMBRANE_R * 1.02, 0.018, 8, 28]} />
              <meshStandardMaterial color={bandColor} roughness={0.42} metalness={0.7} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Status lamp on the front-right frame post */}
      <StatusLight3D position={[SKID_L / 2 - 0.08, 1.58, SKID_W / 2 - 0.07]} status={status} />

      <FloatingPoolLabel3D
        position={[0, 2.05, 0]}
        name={unit.name}
        equipmentId={id}
        selected={isSelected}
        alarm={alarm}
      />
    </group>
  );
};
