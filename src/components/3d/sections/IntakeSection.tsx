import React from 'react';
import { Tank3D } from '../equipment/Tank3D';
import { Pump3D } from '../equipment/Pump3D';
import { Platform3D } from '../site/Platform3D';
import { INTAKE_GROUP } from '../pipes/pipeRouting';
import {
  LIFT_PUMP_LOCAL_Y,
  LIFT_PUMP_LOCAL_Z,
  LIFT_PUMPS,
  LIFT_ROT,
} from './intakeLayout';

interface IntakeSectionProps {
  hasInflow: boolean;
  anyLiftRunning: boolean;
}

const COLLECTION_TANK_SIZE: [number, number, number] = [6, 2, 6];
const COLLECTION_1_LOCAL: [number, number, number] = [0, 0.5, 0];
const COLLECTION_2_LOCAL: [number, number, number] = [6, 0.5, 0];

export const IntakeSection: React.FC<IntakeSectionProps> = () => {
  return (
    <group position={INTAKE_GROUP}>
      <Platform3D position={[0, 0, 0]} size={[24, 0.5, 12]} showRailings={false} />
      <Tank3D id="tk-collection-1" position={COLLECTION_1_LOCAL} size={COLLECTION_TANK_SIZE} wallThickness={0.3} />
      <Tank3D id="tk-collection-2" position={COLLECTION_2_LOCAL} size={COLLECTION_TANK_SIZE} wallThickness={0.3} />
      {LIFT_PUMPS.map(({ id, localX }) => (
        <Pump3D
          key={id}
          id={id}
          position={[localX, LIFT_PUMP_LOCAL_Y, LIFT_PUMP_LOCAL_Z]}
          rotation={[0, LIFT_ROT, 0]}
        />
      ))}
    </group>
  );
};

export { LIFT_PUMPS, LIFT_ROT } from './intakeLayout';
