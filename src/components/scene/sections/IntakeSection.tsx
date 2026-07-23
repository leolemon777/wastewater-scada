import React from 'react';
import { Tank3D } from '../equipment/Tank3D';
import { Pump3D } from '../equipment/Pump3D';
import { Platform3D } from '../site/Platform3D';
import { INTAKE_GROUP } from '../piping/pipeRouting';
import {
  LIFT_PUMP_LOCAL_Y,
  LIFT_PUMP_LOCAL_Z,
  LIFT_PUMPS,
  LIFT_ROT,
} from './intakeLayout';
import { TANK_LAYOUT, type Point3 } from './tankLayout';

interface IntakeSectionProps {
  hasInflow: boolean;
  anyLiftRunning: boolean;
}

function intakeLocal(world: Point3): Point3 {
  return [
    world[0] - INTAKE_GROUP[0],
    world[1] - INTAKE_GROUP[1],
    world[2] - INTAKE_GROUP[2],
  ];
}

export const IntakeSection: React.FC<IntakeSectionProps> = () => {
  return (
    <group position={INTAKE_GROUP}>
      <Platform3D position={[0, 0, 0]} size={[24, 0.5, 12]} showRailings={false} />
      <Tank3D id="tk-collection-1" position={intakeLocal(TANK_LAYOUT['tk-collection-1'].center)} size={TANK_LAYOUT['tk-collection-1'].size} wallThickness={0.3} />
      <Tank3D id="tk-collection-2" position={intakeLocal(TANK_LAYOUT['tk-collection-2'].center)} size={TANK_LAYOUT['tk-collection-2'].size} wallThickness={0.3} />
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
