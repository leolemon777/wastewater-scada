import React from 'react';
import { Tank3D } from '../Tank3D';
import { Pump3D } from '../Pump3D';
import { Platform3D } from '../Platform3D';

interface IntakeSectionProps {
  hasInflow: boolean;
  anyLiftRunning: boolean;
}

const LIFT_ROT = -Math.PI / 2;
const COLLECTION_TANK_SIZE: [number, number, number] = [6, 2, 6];
const COLLECTION_1_POS: [number, number, number] = [-4, 0.5, 0];
const COLLECTION_2_POS: [number, number, number] = [2, 0.5, 0];

const LIFT_PUMPS = [
  { id: 'p-lift-1' as const, x: -3 },
  { id: 'p-lift-2' as const, x: -1 },
  { id: 'p-lift-3' as const, x: 3 },
  { id: 'p-lift-4' as const, x: 5 },
  { id: 'p-gas-lift-1' as const, x: 7 },
  { id: 'p-gas-lift-2' as const, x: 9 },
];

export const IntakeSection: React.FC<IntakeSectionProps> = () => {
  return (
    <group position={[-40, 0, 15]}>
      <Platform3D position={[0, 0, 0]} size={[24, 0.5, 12]} showRailings={false} />
      <Tank3D id="tk-collection-1" position={COLLECTION_1_POS} size={COLLECTION_TANK_SIZE} wallThickness={0.3} />
      <Tank3D id="tk-collection-2" position={COLLECTION_2_POS} size={COLLECTION_TANK_SIZE} wallThickness={0.3} />
      {LIFT_PUMPS.map(({ id, x }) => (
        <Pump3D key={id} id={id} position={[x, 0.5, -4]} rotation={[0, LIFT_ROT, 0]} />
      ))}
    </group>
  );
};
