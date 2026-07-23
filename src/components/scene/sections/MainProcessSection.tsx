import React from 'react';
import { Tank3D } from '../equipment/Tank3D';
import { Pump3D } from '../equipment/Pump3D';
import { Platform3D } from '../site/Platform3D';
import { Clarifier3D } from '../equipment/Clarifier3D';
import { OverflowCascade3D } from '../shared/OverflowCascade3D';
import { MAIN_PROCESS_ORIGIN, PROCESS_PUMP_LAYOUT, mainProcessLocal } from './processPumpLayout';
import { TANK_LAYOUT } from './tankLayout';

interface MainProcessSectionProps {
  mainFlowActive: boolean;
  clarSludgeActive: boolean;
}

const CLARIFIER_SLUDGE_PUMPS = [
  PROCESS_PUMP_LAYOUT.clarifierSludgeA,
  PROCESS_PUMP_LAYOUT.clarifierSludgeB,
];

export const MainProcessSection: React.FC<MainProcessSectionProps> = () => {
  return (
    <group position={MAIN_PROCESS_ORIGIN}>
      <Platform3D position={[0, 0, 0]} size={[70, 0.5, 12]} showRailings={false} />
      <Tank3D id="tk-ph1" position={mainProcessLocal(TANK_LAYOUT['tk-ph1'].center)} size={TANK_LAYOUT['tk-ph1'].size} hasAgitator overflowRight />
      <OverflowCascade3D position={[-27, 0.75, 0]} width={5.4} dropHeight={0.15} />
      <Tank3D id="tk-fenton" position={mainProcessLocal(TANK_LAYOUT['tk-fenton'].center)} size={TANK_LAYOUT['tk-fenton'].size} hasAgitator overflowLeft overflowRight />
      <OverflowCascade3D position={[-21, 0.75, 0]} width={5.4} dropHeight={0.15} />
      <Tank3D id="tk-ph2" position={mainProcessLocal(TANK_LAYOUT['tk-ph2'].center)} size={TANK_LAYOUT['tk-ph2'].size} hasAgitator overflowLeft overflowRight />
      <OverflowCascade3D position={[-15, 0.75, 0]} width={5.4} dropHeight={0.15} />
      <Tank3D id="tk-coagulation" position={mainProcessLocal(TANK_LAYOUT['tk-coagulation'].center)} size={TANK_LAYOUT['tk-coagulation'].size} hasAgitator overflowLeft overflowRight />
      <OverflowCascade3D position={[-9, 0.75, 0]} width={5.4} dropHeight={0.15} />
      <Tank3D id="tk-flocculation" position={mainProcessLocal(TANK_LAYOUT['tk-flocculation'].center)} size={TANK_LAYOUT['tk-flocculation'].size} hasAgitator overflowLeft />
      <Clarifier3D id="tk-clarifier" position={mainProcessLocal(TANK_LAYOUT['tk-clarifier'].center)} size={TANK_LAYOUT['tk-clarifier'].size} />
      <Tank3D id="tk-ph3" position={mainProcessLocal(TANK_LAYOUT['tk-ph3'].center)} size={TANK_LAYOUT['tk-ph3'].size} hasAgitator />
      <Tank3D id="tk-intermediate" position={mainProcessLocal(TANK_LAYOUT['tk-intermediate'].center)} size={TANK_LAYOUT['tk-intermediate'].size} />

      {CLARIFIER_SLUDGE_PUMPS.map(({ id, position, rotationY }) => (
        <Pump3D key={id} id={id} position={mainProcessLocal(position)} rotation={[0, rotationY, 0]} />
      ))}
    </group>
  );
};
