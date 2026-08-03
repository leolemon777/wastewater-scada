import React from 'react';
import { Tank3D } from '../equipment/Tank3D';
import { Pump3D } from '../equipment/Pump3D';
import { Platform3D } from '../site/Platform3D';
import { SludgePlatformAccessRamp3D, SludgePlatformRampOpening3D } from '../site/PlatformAccessRamp3D';
import { SLUDGE_GROUP_ORIGIN, SLUDGE_PLATFORM_SIZE } from '../site/sludgePlatformLayout';
import { ScrewPress3D } from '../equipment/ScrewPress3D';
import { ScrewPressHouse3D } from '../site/ScrewPressHouse3D';
import { PROCESS_PUMP_LAYOUT, sludgePlatformLocal } from './processPumpLayout';
import { TANK_LAYOUT } from './tankLayout';

interface SludgeSectionProps {
  isDafSludgeRunning: boolean;
  isOutSludgeRunning: boolean;
}

const SLUDGE_GROUP: [number, number, number] = SLUDGE_GROUP_ORIGIN;
export const SludgeSection: React.FC<SludgeSectionProps> = ({ isOutSludgeRunning }) => {
  return (
    <>
      <SludgePlatformAccessRamp3D />
      <SludgePlatformRampOpening3D />
      <ScrewPressHouse3D />

      <Pump3D id={PROCESS_PUMP_LAYOUT.dafSludgeA.id} position={[...PROCESS_PUMP_LAYOUT.dafSludgeA.position]} rotation={[0, PROCESS_PUMP_LAYOUT.dafSludgeA.rotationY, 0]} />
      <Pump3D id={PROCESS_PUMP_LAYOUT.dafSludgeB.id} position={[...PROCESS_PUMP_LAYOUT.dafSludgeB.position]} rotation={[0, PROCESS_PUMP_LAYOUT.dafSludgeB.rotationY, 0]} />

      <group position={SLUDGE_GROUP}>
        <Platform3D position={[0, 0, 0]} size={SLUDGE_PLATFORM_SIZE} showRailings={false} />
        <Tank3D id="tk-sludge" position={sludgePlatformLocal(TANK_LAYOUT['tk-sludge'].center)} size={TANK_LAYOUT['tk-sludge'].size} hasAgitator />
        <Pump3D id={PROCESS_PUMP_LAYOUT.sludgeOutA.id} position={sludgePlatformLocal(PROCESS_PUMP_LAYOUT.sludgeOutA.position)} rotation={[0, PROCESS_PUMP_LAYOUT.sludgeOutA.rotationY, 0]} />
        <Pump3D id={PROCESS_PUMP_LAYOUT.sludgeOutB.id} position={sludgePlatformLocal(PROCESS_PUMP_LAYOUT.sludgeOutB.position)} rotation={[0, PROCESS_PUMP_LAYOUT.sludgeOutB.rotationY, 0]} />
        <ScrewPress3D id="sp-1" position={[4, 1, 0]} active={isOutSludgeRunning} />
      </group>
    </>
  );
};
