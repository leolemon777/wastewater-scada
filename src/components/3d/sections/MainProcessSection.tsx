import React from 'react';
import { Tank3D } from '../equipment/Tank3D';
import { Pump3D } from '../equipment/Pump3D';
import { Platform3D } from '../site/Platform3D';
import { Clarifier3D } from '../equipment/Clarifier3D';
import { OverflowCascade3D } from '../shared/OverflowCascade3D';

interface MainProcessSectionProps {
  mainFlowActive: boolean;
  clarSludgeActive: boolean;
}

const CLARIFIER_SLUDGE_PUMPS = [
  { id: 'p-sludge-clar-1' as const, position: [11, 0.5, 5] as [number, number, number] },
  { id: 'p-sludge-clar-2' as const, position: [13, 0.5, 5] as [number, number, number] },
];

export const MainProcessSection: React.FC<MainProcessSectionProps> = () => {
  return (
    <group position={[-10, 0, 0]}>
      <Platform3D position={[0, 0, 0]} size={[70, 0.5, 12]} showRailings={false} />
      <Tank3D id="tk-ph1" position={[-30, 0.5, 0]} size={[6, 2, 6]} hasAgitator overflowRight />
      <OverflowCascade3D position={[-27, 0.75, 0]} width={5.4} dropHeight={0.15} />
      <Tank3D id="tk-fenton" position={[-24, 0.5, 0]} size={[6, 2, 6]} hasAgitator overflowLeft overflowRight />
      <OverflowCascade3D position={[-21, 0.75, 0]} width={5.4} dropHeight={0.15} />
      <Tank3D id="tk-ph2" position={[-18, 0.5, 0]} size={[6, 2, 6]} hasAgitator overflowLeft overflowRight />
      <OverflowCascade3D position={[-15, 0.75, 0]} width={5.4} dropHeight={0.15} />
      <Tank3D id="tk-coagulation" position={[-12, 0.5, 0]} size={[6, 2, 6]} hasAgitator overflowLeft overflowRight />
      <OverflowCascade3D position={[-9, 0.75, 0]} width={5.4} dropHeight={0.15} />
      <Tank3D id="tk-flocculation" position={[-6, 0.5, 0]} size={[6, 2, 6]} hasAgitator overflowLeft />
      <Clarifier3D id="tk-clarifier" position={[12, 0.5, 0]} size={[8, 2, 8]} />
      <Tank3D id="tk-ph3" position={[21, 0.5, 0]} size={[6, 2, 6]} hasAgitator />
      <Tank3D id="tk-intermediate" position={[29, 0.5, 0]} size={[6, 2, 6]} />

      {CLARIFIER_SLUDGE_PUMPS.map(({ id, position }) => (
        <Pump3D key={id} id={id} position={position} rotation={[0, 0, 0]} />
      ))}
    </group>
  );
};
