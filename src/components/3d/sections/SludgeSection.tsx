import React from 'react';
import { Tank3D } from '../equipment/Tank3D';
import { Pump3D } from '../equipment/Pump3D';
import { Platform3D } from '../site/Platform3D';
import { SludgePlatformAccessRamp3D, SludgePlatformRampOpening3D } from '../site/PlatformAccessRamp3D';
import { SLUDGE_GROUP_ORIGIN, SLUDGE_PLATFORM_SIZE } from '../site/sludgePlatformLayout';
import { ScrewPress3D } from '../equipment/ScrewPress3D';

interface SludgeSectionProps {
  isDafSludgeRunning: boolean;
  isOutSludgeRunning: boolean;
}

const SLUDGE_GROUP: [number, number, number] = SLUDGE_GROUP_ORIGIN;
const DAF_SLUDGE_PUMP_A: [number, number, number] = [6.8, 0.5, -20.55];
const DAF_SLUDGE_PUMP_B: [number, number, number] = [9.2, 0.5, -20.55];
const DAF_SLUDGE_ROT = Math.PI;

export const SludgeSection: React.FC<SludgeSectionProps> = ({ isOutSludgeRunning }) => {
  return (
    <>
      <SludgePlatformAccessRamp3D />
      <SludgePlatformRampOpening3D />

      <Pump3D id="p-sludge-daf-1" position={DAF_SLUDGE_PUMP_A} rotation={[0, DAF_SLUDGE_ROT, 0]} />
      <Pump3D id="p-sludge-daf-2" position={DAF_SLUDGE_PUMP_B} rotation={[0, DAF_SLUDGE_ROT, 0]} />

      <group position={SLUDGE_GROUP}>
        <Platform3D position={[0, 0, 0]} size={SLUDGE_PLATFORM_SIZE} showRailings={false} />
        <Tank3D id="tk-sludge" position={[-10, 0.5, 0]} size={[8, 2, 8]} hasAgitator />
        <Pump3D id="p-sludge-out-1" position={[-4, 0.5, -2]} rotation={[0, Math.PI / 2, 0]} />
        <Pump3D id="p-sludge-out-2" position={[-4, 0.5, 2]} rotation={[0, Math.PI / 2, 0]} />
        <ScrewPress3D id="sp-1" position={[4, 1, 0]} active={isOutSludgeRunning} />
      </group>
    </>
  );
};
