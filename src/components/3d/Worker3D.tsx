import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useScadaStore, type TankData, type PumpData, type FlowMeterData } from '../../store/useScadaStore';
import { getPatrolFacingYaw, getPatrolSurfaceY, planWorkerStep, resolvePatrolStandPosition, segmentCrossesWorkerObstacle, WORKER_OBSTACLE_AABBS } from './patrolRoutes';

interface Worker3DProps {
  position?: [number, number, number];
  rotation?: number; // Y-axis rotation in radians (initial / default)
  variant?: 'clipboard' | 'tablet' | 'scanning' | 'probe';
  /** Display name for patrol logs (overrides variant default). */
  workerLabel?: string;
  animate?: boolean;
  patrolPath?: [number, number, number][]; // Waypoints for patrolling
  patrolTargets?: string[]; // Associated equipment IDs to report on!
  /** Axis-aligned path from last patrol stop to assigned office rest slot. */
  officeToPath?: [number, number, number][];
  /** Return path from office back to patrol start. */
  officeReturnPath?: [number, number, number][];
  officeRestTime?: number;
  /** Stagger spawn so six workers do not step in lockstep. */
  startDelay?: number;
  speed?: number;
  pauseTime?: number; // Base pause time at each waypoint in seconds
}

type WorkerPhase = 'patrol' | 'toOffice' | 'resting' | 'returnPatrol';

/**
 * Industrial inspection worker figure with:
 * - Refined anatomy & joints (elbows, knees, pelvis, shoulder pads)
 * - Restrained hard hat, glasses, workwear, and reflective vest details for close-up views
 * - Detailed heavy-duty work boots (heel, thick sole, steel-toe cap)
 * - Nitrile safety gloves with cuffs
 * - Knee-bend walking animation and elbow-bend posture holding tools
 * - Dynamic patrolling system on multi-node loops
 */
export const Worker3D: React.FC<Worker3DProps> = ({
  position = [0, 0, 0],
  rotation = 0,
  variant = 'clipboard',
  workerLabel,
  animate = true,
  patrolPath = [],
  patrolTargets = [],
  officeToPath = [],
  officeReturnPath = [],
  officeRestTime = 18,
  startDelay = 0,
  speed = 1.6,
  pauseTime = 3.0,
}) => {
  const equipments = useScadaStore((s) => s.equipments);
  const isRainy = false;
  const apparelColor = isRainy ? "#8A4F22" : "#243145";
  const collarColor = isRainy ? "#5C351C" : "#182231";
  const pantsColor = isRainy ? "#202938" : "#252E3A";
  // Less toy-like than pure orange; still reads as high-vis PPE in the plant.
  const vestColor = isRainy ? "#BFCB3A" : "#C96A24";
  const skinColor = "#C58B65";
  const fabricRoughness = 0.82;

  // References for hierarchical animation
  const groupRef = useRef<THREE.Group>(null);
  const upperBodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  
  // Left leg joint chain (hip -> knee -> foot)
  const leftLegRef = useRef<THREE.Group>(null); // Thigh / Hip
  const leftShinRef = useRef<THREE.Group>(null); // Shin / Knee
  
  // Right leg joint chain (hip -> knee -> foot)
  const rightLegRef = useRef<THREE.Group>(null); // Thigh / Hip
  const rightShinRef = useRef<THREE.Group>(null); // Shin / Knee
  
  // Left arm joint chain (shoulder -> elbow -> hand)
  const leftArmRef = useRef<THREE.Group>(null); // Upper Arm
  const leftForearmRef = useRef<THREE.Group>(null); // Forearm
  
  // Right arm joint chain (shoulder -> elbow -> hand)
  const rightArmRef = useRef<THREE.Group>(null); // Upper Arm
  const rightForearmRef = useRef<THREE.Group>(null); // Forearm
  
  // Interactive tool references
  const penRef = useRef<THREE.Mesh>(null);
  const scannerBeamRef = useRef<THREE.Mesh>(null);
  const probeCableRef = useRef<THREE.Mesh>(null);

  // Path patrol state refs
  const currentPos = useRef<THREE.Vector3>(new THREE.Vector3(...(patrolPath[0] || position)));
  const targetIdx = useRef<number>(patrolPath.length > 1 ? 1 : 0);
  const curRotation = useRef<number>(rotation);
  const pauseTimer = useRef<number>(0);
  const isWalking = useRef<boolean>(patrolPath.length > 1);
  const animTime = useRef<number>(0);
  const blockStreak = useRef<number>(0);
  const phase = useRef<WorkerPhase>('patrol');
  const transitIdx = useRef<number>(0);
  const hasOfficeCycle = officeToPath.length > 0 && officeReturnPath.length > 0;
  const lapCompletedPending = useRef<boolean>(false);
  const spawnHold = useRef<number>(0);
  const [inspectingEquipmentId, setInspectingEquipmentId] = useState<string | null>(null);
  const inspectingIdRef = useRef<string | null>(null);
  // Deferred setState channel: the frame loop only flips a ref + schedules a single
  // microtask that flushes the value into React state. This avoids unbatched re-renders
  // scheduled from within useFrame at every waypoint transition, and collapses multiple
  // same-tick changes into one render.
  const pendingInspectionId = useRef<string | null | undefined>(undefined);
  const flushScheduled = useRef<boolean>(false);
  const flushInspectionId = () => {
    flushScheduled.current = false;
    const next = pendingInspectionId.current;
    pendingInspectionId.current = undefined;
    if (next !== undefined) {
      setInspectingEquipmentId(next);
    }
  };
  // Commit an inspection-id change from the frame loop. No-op when unchanged; otherwise
  // records the new value on a ref and defers the React setState to a microtask.
  const commitInspectionId = (id: string | null) => {
    if (inspectingIdRef.current === id) return;
    inspectingIdRef.current = id;
    pendingInspectionId.current = id;
    if (flushScheduled.current) return;
    flushScheduled.current = true;
    queueMicrotask(flushInspectionId);
  };

  // Boot sole lowest point ≈ −0.025 local × scale 1.4 ≈ −0.035 world units below group origin.
  const FOOT_OFFSET = 0.035;

  // Stringified path for stable useEffect dependency (prevents resets on parent renders)
  const pathString = JSON.stringify(patrolPath);

  // Initialize position to first waypoint if available
  useEffect(() => {
    if (patrolPath.length > 0) {
      const start = patrolPath[0];
      currentPos.current.set(
        start[0],
        getPatrolSurfaceY(start[0], start[2]) + FOOT_OFFSET,
        start[2],
      );
      if (groupRef.current) {
        groupRef.current.position.copy(currentPos.current);
      }
      targetIdx.current = patrolPath.length > 1 ? 1 : 0;
      phase.current = 'patrol';
      transitIdx.current = 0;
      lapCompletedPending.current = false;
      spawnHold.current = startDelay > 0 ? startDelay : 0;
      pauseTimer.current = 0;
      isWalking.current = patrolPath.length > 1;
    }
  }, [pathString, startDelay]);

  // Log patrol events to the store
  useEffect(() => {
    if (!inspectingEquipmentId) return;
    const eq = equipments[inspectingEquipmentId];
    if (!eq) return;

    let statusText = '';
    const isAlarm = eq.alarmState !== 'none';
    
    if (eq.type === 'tank' || eq.type === 'mixingTank' || eq.type === 'chemicalTank') {
      const tk = eq as TankData;
      if (tk.pH !== undefined) {
        statusText = `pH为 ${tk.pH.toFixed(2)} (${isAlarm ? '异常' : '正常'})`;
      } else if (tk.pH1 !== undefined) {
        statusText = `pH1为 ${tk.pH1.toFixed(2)} | pH2为 ${tk.pH2?.toFixed(2) ?? '0.00'}`;
      } else if (tk.levelValue !== undefined) {
        statusText = `液位为 ${tk.levelValue.toFixed(2)}m (${isAlarm ? '异常' : '正常'})`;
      } else {
        statusText = `状态${isAlarm ? '异常' : '正常'}`;
      }
    } else if (eq.type === 'pump') {
      const p = eq as PumpData;
      statusText = `运行状态为 [${p.runStatus === 'running' ? '开启' : p.runStatus === 'fault' ? '故障' : '停机'}]，运行电流 ${p.current?.toFixed(1) ?? 0}A`;
    } else if (eq.type === 'flowMeter') {
      const fm = eq as FlowMeterData;
      statusText = `瞬时流量为 ${fm.instantFlow.toFixed(1)}m³/h，累计流量为 ${fm.totalFlow.toFixed(0)}m³`;
    } else {
      statusText = `状态${isAlarm ? '异常' : '正常'}`;
    }

    const workerName = workerLabel ?? (variant === 'clipboard'
      ? '中控巡检员 (记录板)'
      : variant === 'tablet'
        ? '现场主管 (智能平板)'
        : variant === 'scanning'
          ? '安环工程师 (红外扫描)'
          : '化验分析员 (便携探针)');

    useScadaStore.getState().addPatrolLog(`${workerName} 正在核查 [${eq.name}]: ${statusText}`);
    useScadaStore.getState().setActiveInspectionEquipmentId(eq.id);

    return () => {
      useScadaStore.getState().setActiveInspectionEquipmentId(null);
    };
  }, [inspectingEquipmentId, workerLabel, variant, equipments]);

  const resolvedWorkerName =
    workerLabel ??
    (variant === 'clipboard'
      ? '中控巡检员 (记录板)'
      : variant === 'tablet'
        ? '现场主管 (智能平板)'
        : variant === 'scanning'
          ? '安环工程师 (红外扫描)'
          : '化验分析员 (便携探针)');

  useFrame((state, delta) => {
    if (!animate) return;
    
    // Clamp extreme delta to prevent visual jumps on tab focus switch
    const dt = Math.min(delta, 0.1);

    if (spawnHold.current > 0) {
      spawnHold.current -= dt;
      isWalking.current = false;
      commitInspectionId(null);
      const t = state.clock.elapsedTime;
      if (headRef.current) {
        headRef.current.rotation.y = Math.sin(t * 0.5) * 0.05;
      }
      const holdFootY =
        getPatrolSurfaceY(currentPos.current.x, currentPos.current.z) + FOOT_OFFSET;
      currentPos.current.y += (holdFootY - currentPos.current.y) * Math.min(1, dt * 10);
      if (groupRef.current) {
        groupRef.current.position.copy(currentPos.current);
      }
      return;
    }
    
    // ----------------------------------------
    // 1. PATROL PATH MOVEMENT STATE MACHINE
    // ----------------------------------------
    const hasPath = patrolPath.length > 1;

    if (hasPath) {
      const activePath =
        phase.current === 'toOffice'
          ? officeToPath
          : phase.current === 'returnPatrol'
            ? officeReturnPath
            : patrolPath;
      const activeTargets = phase.current === 'patrol' ? patrolTargets : [];
      const activeIdx =
        phase.current === 'patrol' ? targetIdx.current : transitIdx.current;

      if (phase.current === 'resting') {
        pauseTimer.current -= dt;
        isWalking.current = false;
        commitInspectionId(null);

        const t = state.clock.elapsedTime;
        if (headRef.current) {
          headRef.current.rotation.x = Math.sin(t * 0.6) * 0.04;
          headRef.current.rotation.y = Math.sin(t * 0.4) * 0.06;
        }
        if (upperBodyRef.current) {
          upperBodyRef.current.rotation.x += (0 - upperBodyRef.current.rotation.x) * 0.12;
        }

        const restFootY =
          getPatrolSurfaceY(currentPos.current.x, currentPos.current.z) + FOOT_OFFSET;
        currentPos.current.y += (restFootY - currentPos.current.y) * Math.min(1, dt * 10);
        if (groupRef.current) {
          groupRef.current.position.copy(currentPos.current);
        }

        if (pauseTimer.current <= 0) {
          pauseTimer.current = 0;
          phase.current = 'returnPatrol';
          transitIdx.current = 0;
        }
        return;
      }

      if (pauseTimer.current > 0) {
        // Paused at waypoint inspecting
        pauseTimer.current -= dt;
        isWalking.current = false;

        if (pauseTimer.current <= 0 && lapCompletedPending.current && phase.current === 'patrol') {
          lapCompletedPending.current = false;
          pauseTimer.current = 0;
          phase.current = 'toOffice';
          transitIdx.current = 0;
          commitInspectionId(null);
          return;
        }

        // Set inspecting equipment ID to trigger state change and show speech bubble.
        const currentWaypointIdx =
          phase.current === 'patrol'
            ? (targetIdx.current === 0 ? patrolPath.length : targetIdx.current) - 1
            : -1;
        const targetId = currentWaypointIdx >= 0 ? activeTargets[currentWaypointIdx] : null;
        if (targetId) {
          commitInspectionId(targetId);
        } else {
          commitInspectionId(null);
        }
        
        // Play inspection specific actions
        const t = state.clock.elapsedTime;
        
        // Smoothly return legs to straight standing position
        if (leftLegRef.current) leftLegRef.current.rotation.x += (0 - leftLegRef.current.rotation.x) * 0.15;
        if (leftShinRef.current) leftShinRef.current.rotation.x += (0.05 - leftShinRef.current.rotation.x) * 0.15;
        if (rightLegRef.current) rightLegRef.current.rotation.x += (0 - rightLegRef.current.rotation.x) * 0.15;
        if (rightShinRef.current) rightShinRef.current.rotation.x += (0.05 - rightShinRef.current.rotation.x) * 0.15;
        if (upperBodyRef.current) {
          upperBodyRef.current.position.y += (0.8 - upperBodyRef.current.position.y) * 0.15;
          upperBodyRef.current.rotation.x += (0 - upperBodyRef.current.rotation.x) * 0.15;
        }

        // Visual check-up actions based on variant
        if (variant === 'clipboard') {
          if (rightArmRef.current) {
            rightArmRef.current.rotation.x = -0.4 + Math.sin(t * 12) * 0.04;
            rightArmRef.current.rotation.y = 0.1;
          }
          if (rightForearmRef.current) {
            rightForearmRef.current.rotation.x = -1.2 + Math.cos(t * 12) * 0.08;
          }
          if (penRef.current) {
            penRef.current.position.y = 0.02 + Math.sin(t * 18) * 0.01;
          }
          if (headRef.current) {
            headRef.current.rotation.x = 0.25 + Math.sin(t * 3) * 0.08;
            headRef.current.rotation.y = Math.sin(t * 1.5) * 0.15;
          }
        } 
        else if (variant === 'tablet') {
          if (rightArmRef.current) {
            rightArmRef.current.rotation.x = -0.35 + Math.sin(t * 10) * 0.03;
          }
          if (rightForearmRef.current) {
            rightForearmRef.current.rotation.x = -1.1 + Math.sin(t * 10) * 0.05;
          }
          if (leftArmRef.current) {
            leftArmRef.current.rotation.x = -0.4;
          }
          if (leftForearmRef.current) {
            leftForearmRef.current.rotation.x = -1.0 + Math.sin(t * 14) * 0.04;
          }
          if (headRef.current) {
            headRef.current.rotation.x = 0.2 + Math.abs(Math.sin(t * 2)) * 0.05;
            headRef.current.rotation.y = Math.sin(t * 0.8) * 0.1;
          }
        } 
        else if (variant === 'scanning') {
          if (rightArmRef.current) {
            rightArmRef.current.rotation.x = -0.2 + Math.sin(t * 1.5) * 0.08;
            rightArmRef.current.rotation.y = Math.sin(t * 2) * 0.25;
          }
          if (rightForearmRef.current) {
            rightForearmRef.current.rotation.x = -0.6 + Math.sin(t * 1.5) * 0.05;
          }
          if (headRef.current) {
            headRef.current.rotation.y = Math.sin(t * 2) * 0.3;
            headRef.current.rotation.x = 0.1 + Math.sin(t * 0.5) * 0.05;
          }
          if (scannerBeamRef.current) {
            scannerBeamRef.current.visible = false;
          }
        } 
        else if (variant === 'probe') {
          if (upperBodyRef.current) {
            upperBodyRef.current.rotation.x += (0.28 - upperBodyRef.current.rotation.x) * 0.15;
          }
          if (rightArmRef.current) {
            rightArmRef.current.rotation.x = 0.35 + Math.sin(t * 2) * 0.12;
            rightArmRef.current.rotation.y = -0.1 + Math.cos(t * 1.5) * 0.05;
          }
          if (rightForearmRef.current) {
            rightForearmRef.current.rotation.x = -0.8 + Math.cos(t * 2) * 0.08;
          }
          if (headRef.current) {
            headRef.current.rotation.x = 0.35 + Math.sin(t * 1.5) * 0.05;
            headRef.current.rotation.y = Math.sin(t * 1.2) * 0.08;
          }
        }

        const pauseFootY =
          getPatrolSurfaceY(currentPos.current.x, currentPos.current.z) + FOOT_OFFSET;
        currentPos.current.y += (pauseFootY - currentPos.current.y) * Math.min(1, dt * 10);
        if (groupRef.current) {
          groupRef.current.position.copy(currentPos.current);
        }
      } 
      else if (activePath.length > 0) {
        // Walking towards target waypoint
        isWalking.current = true;
        commitInspectionId(null);
        if (scannerBeamRef.current) {
          scannerBeamRef.current.visible = false;
        }

        const rawTarget = activePath[activeIdx];
        const goal = resolvePatrolStandPosition(rawTarget[0], rawTarget[2], WORKER_OBSTACLE_AABBS);
        const targetX = goal.x;
        const targetZ = goal.z;

        const dx = targetX - currentPos.current.x;
        const dz = targetZ - currentPos.current.z;
        const stepSize = speed * dt;

        const nearGoal = Math.hypot(dx, dz) < 0.15;
        const blockedNearGoal =
          blockStreak.current > 6 && Math.hypot(dx, dz) < 1.35;

        if (nearGoal || blockedNearGoal) {
          // Before snapping, verify the close-range shot is actually obstacle-free.
          // `blockedNearGoal` exists to recover from numerical jams near a waypoint,
          // NOT to teleport through walls. If the straight line to the target crosses
          // an obstacle, abandon this waypoint and advance to the next one instead.
          const clearShot = !segmentCrossesWorkerObstacle(
            currentPos.current.x,
            currentPos.current.z,
            targetX,
            targetZ,
            WORKER_OBSTACLE_AABBS,
            0.35,
          );

          if (nearGoal || (blockedNearGoal && clearShot)) {
            blockStreak.current = 0;
            currentPos.current.set(
              targetX,
              getPatrolSurfaceY(targetX, targetZ) + FOOT_OFFSET,
              targetZ,
            );

            if (phase.current === 'patrol') {
              const wpIdx = targetIdx.current;
              const targetId = patrolTargets[wpIdx];
              const faceYaw = targetId
                ? getPatrolFacingYaw(targetId, targetX, targetZ)
                : null;
              if (faceYaw !== null) {
                curRotation.current = faceYaw;
                if (groupRef.current) groupRef.current.rotation.y = faceYaw;
              }

              if (wpIdx === patrolPath.length - 1 && hasOfficeCycle) {
                lapCompletedPending.current = true;
              }

              pauseTimer.current = pauseTime + Math.random() * 2.5;
              targetIdx.current = (targetIdx.current + 1) % patrolPath.length;
              isWalking.current = false;
            } else if (phase.current === 'toOffice') {
              if (transitIdx.current >= officeToPath.length - 1) {
                phase.current = 'resting';
                pauseTimer.current = officeRestTime + Math.random() * 3;
                isWalking.current = false;
                useScadaStore.getState().addPatrolLog(`${resolvedWorkerName} 完成本轮巡检，回值班室休息`);
              } else {
                transitIdx.current += 1;
              }
            } else if (phase.current === 'returnPatrol') {
              if (transitIdx.current >= officeReturnPath.length - 1) {
                phase.current = 'patrol';
                targetIdx.current = patrolPath.length > 1 ? 1 : 0;
                transitIdx.current = 0;
                useScadaStore.getState().addPatrolLog(`${resolvedWorkerName} 休息结束，继续巡检`);
              } else {
                transitIdx.current += 1;
              }
            }

            if (groupRef.current) {
              groupRef.current.position.copy(currentPos.current);
            }
          } else if (blockedNearGoal) {
            // Path to this waypoint is genuinely blocked (would teleport through an
            // obstacle): skip it and try the next waypoint. Reset the streak so we
            // don't burn another 6 frames re-blocking on the same bad segment.
            blockStreak.current = 0;
            if (phase.current === 'patrol') {
              targetIdx.current = (targetIdx.current + 1) % patrolPath.length;
            } else if (phase.current === 'toOffice' || phase.current === 'returnPatrol') {
              transitIdx.current += 1;
            }
          }
        } else {
          let moveX = 0;
          let moveZ = 0;
          if (Math.abs(dx) > 0.15) {
            moveX = Math.sign(dx) * Math.min(Math.abs(dx), stepSize);
          } else if (Math.abs(dz) > 0.15) {
            moveZ = Math.sign(dz) * Math.min(Math.abs(dz), stepSize);
          }

          const prevX = currentPos.current.x;
          const prevZ = currentPos.current.z;

          const planned = planWorkerStep(
            currentPos.current.x,
            currentPos.current.z,
            moveX,
            moveZ,
            WORKER_OBSTACLE_AABBS,
          );

          if (planned.moved) {
            currentPos.current.x = planned.x;
            currentPos.current.z = planned.z;
            blockStreak.current = 0;
          } else {
            blockStreak.current += 1;
          }

          const liveFootY =
            getPatrolSurfaceY(currentPos.current.x, currentPos.current.z) + FOOT_OFFSET;
          currentPos.current.y += (liveFootY - currentPos.current.y) * Math.min(1, dt * 14);

          if (groupRef.current) {
            groupRef.current.position.copy(currentPos.current);
          }

          const actualMoveX = currentPos.current.x - prevX;
          const actualMoveZ = currentPos.current.z - prevZ;
          const targetRot = Math.abs(actualMoveX) > Math.abs(actualMoveZ)
            ? (actualMoveX > 0 ? Math.PI / 2 : -Math.PI / 2)
            : (actualMoveZ > 0 ? 0 : Math.PI);
          let diffAngle = targetRot - curRotation.current;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;

          curRotation.current += diffAngle * Math.min(1.0, dt * 7.5);
          if (groupRef.current) {
            groupRef.current.rotation.y = curRotation.current;
          }
        }
      }
    } else {
      // No patrol path, subtle standing idle sway
      isWalking.current = false;
      commitInspectionId(null);
      const t = state.clock.elapsedTime;
      if (groupRef.current) {
        groupRef.current.position.set(
          position[0],
          getPatrolSurfaceY(position[0], position[2]) + FOOT_OFFSET,
          position[2],
        );
        groupRef.current.rotation.y = rotation + Math.sin(t * 0.4 + position[0]) * 0.03;
      }
      if (headRef.current) {
        headRef.current.rotation.y = Math.sin(t * 0.5) * 0.05;
      }
      // Return elements to neutral
      if (leftLegRef.current) leftLegRef.current.rotation.x += (0 - leftLegRef.current.rotation.x) * 0.1;
      if (leftShinRef.current) leftShinRef.current.rotation.x += (0.05 - leftShinRef.current.rotation.x) * 0.1;
      if (rightLegRef.current) rightLegRef.current.rotation.x += (0 - rightLegRef.current.rotation.x) * 0.1;
      if (rightShinRef.current) rightShinRef.current.rotation.x += (0.05 - rightShinRef.current.rotation.x) * 0.1;
    }

    // ----------------------------------------
    // 2. WALKING LIMB SWING & KNEE BEND ANIMATION
    // ----------------------------------------
    if (isWalking.current) {
      // Accumulate animation phase based on speed
      animTime.current += dt * speed * 5.0;

      const swingFreq = animTime.current;
      const legSwingAngle = Math.sin(swingFreq) * 0.34; // Natural patrol stride; avoids cartoon over-swing.
      
      // Swing thighs from the hip
      if (leftLegRef.current) leftLegRef.current.rotation.x = legSwingAngle;
      if (rightLegRef.current) rightLegRef.current.rotation.x = -legSwingAngle;

      // Knee bend: bend knee when leg is swinging forward, straighten when pushing back
      if (leftShinRef.current) {
        leftShinRef.current.rotation.x = legSwingAngle > 0 ? legSwingAngle * 0.62 : 0.04;
      }
      if (rightShinRef.current) {
        rightShinRef.current.rotation.x = legSwingAngle < 0 ? -legSwingAngle * 0.62 : 0.04;
      }

      // Bob upper body up/down and lean forward slightly during movement
      if (upperBodyRef.current) {
        upperBodyRef.current.position.y = 0.8 + Math.abs(Math.sin(swingFreq * 2)) * 0.018;
        upperBodyRef.current.rotation.x = 0.045 + Math.sin(swingFreq * 2) * 0.01; // Subtle forward lean bob.
      }

      // Head bobbing counter-balance
      if (headRef.current) {
        headRef.current.rotation.x = 0.05 - Math.sin(swingFreq * 2) * 0.03;
        headRef.current.rotation.y = Math.sin(swingFreq) * 0.03;
      }

      // Swing arms
      const armSwingAngle = Math.sin(swingFreq) * 0.22;
      
      // Left arm always swings during walk
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x = -armSwingAngle;
        leftArmRef.current.rotation.z = -0.05;
      }
      if (leftForearmRef.current) {
        leftForearmRef.current.rotation.x = 0.2 + Math.cos(swingFreq) * 0.1; // slight elbow swing bounce
      }

      // Right arm behaves depending on variant
      if (rightArmRef.current) {
        if (variant === 'clipboard' || variant === 'tablet') {
          // Keep clipboard/tablet stable near chest while walking, slight bounce
          rightArmRef.current.rotation.x = -0.4 + Math.sin(swingFreq * 2) * 0.03;
          rightArmRef.current.rotation.y = 0.05;
        } else {
          // Scanning detector or probe swings naturally but slightly raised
          rightArmRef.current.rotation.x = 0.25 + armSwingAngle;
          rightArmRef.current.rotation.y = -0.05;
        }
      }
      if (rightForearmRef.current) {
        if (variant === 'clipboard' || variant === 'tablet') {
          rightForearmRef.current.rotation.x = -1.1 + Math.cos(swingFreq * 2) * 0.04;
        } else {
          rightForearmRef.current.rotation.x = 0.3 + Math.sin(swingFreq) * 0.1;
        }
      }
    } 
    else if (pauseTimer.current <= 0) {
      // Idle / Standard Standing
      if (leftLegRef.current) leftLegRef.current.rotation.x += (0 - leftLegRef.current.rotation.x) * 0.1;
      if (leftShinRef.current) leftShinRef.current.rotation.x += (0.05 - leftShinRef.current.rotation.x) * 0.1;
      if (rightLegRef.current) rightLegRef.current.rotation.x += (0 - rightLegRef.current.rotation.x) * 0.1;
      if (rightShinRef.current) rightShinRef.current.rotation.x += (0.05 - rightShinRef.current.rotation.x) * 0.1;
      
      if (upperBodyRef.current) {
        upperBodyRef.current.position.y += (0.8 - upperBodyRef.current.position.y) * 0.1;
        upperBodyRef.current.rotation.x += (0 - upperBodyRef.current.rotation.x) * 0.1;
      }
      if (leftArmRef.current) {
        leftArmRef.current.rotation.x += (0 - leftArmRef.current.rotation.x) * 0.1;
        leftArmRef.current.rotation.z += (-0.05 - leftArmRef.current.rotation.z) * 0.1;
      }
      if (leftForearmRef.current) {
        leftForearmRef.current.rotation.x += (0.1 - leftForearmRef.current.rotation.x) * 0.1;
      }
      if (rightArmRef.current) {
        if (variant === 'clipboard' || variant === 'tablet') {
          rightArmRef.current.rotation.x += (-0.35 - rightArmRef.current.rotation.x) * 0.1;
        } else {
          rightArmRef.current.rotation.x += (0.1 - rightArmRef.current.rotation.x) * 0.1;
        }
      }
      if (rightForearmRef.current) {
        if (variant === 'clipboard' || variant === 'tablet') {
          rightForearmRef.current.rotation.x += (-1.1 - rightForearmRef.current.rotation.x) * 0.1;
        } else {
          rightForearmRef.current.rotation.x += (0.2 - rightForearmRef.current.rotation.x) * 0.1;
        }
      }
    }
  });

  const S = 1.32; // Slightly smaller and less toy-like while still readable in the wide site view.

  // Floating speech bubble during inspection pause
  const renderSpeechBubble = () => {
    if (!inspectingEquipmentId) return null;
    
    const eq = equipments[inspectingEquipmentId];
    if (!eq) return null;
    
    let statusText = '';
    const isAlarm = eq.alarmState !== 'none';
    const statusColor = isAlarm ? '#ef4444' : '#10b981';
    
    if (eq.type === 'tank' || eq.type === 'mixingTank' || eq.type === 'chemicalTank') {
      const tk = eq as TankData;
      if (tk.pH !== undefined) {
        statusText = `pH: ${tk.pH.toFixed(2)} (${isAlarm ? '异常' : '正常'})`;
      } else if (tk.pH1 !== undefined) {
        statusText = `pH1: ${tk.pH1.toFixed(2)} | pH2: ${tk.pH2?.toFixed(2) ?? '0.00'}`;
      } else if (tk.levelValue !== undefined) {
        statusText = `液位: ${tk.levelValue.toFixed(2)}m (${isAlarm ? '异常' : '正常'})`;
      } else {
        statusText = `状态: ${isAlarm ? '异常' : '正常'}`;
      }
    } else if (eq.type === 'pump') {
      const p = eq as PumpData;
      statusText = `运行: ${p.runStatus === 'running' ? '开启' : p.runStatus === 'fault' ? '故障' : '停机'} | 电流: ${p.current?.toFixed(1) ?? 0}A`;
    } else if (eq.type === 'flowMeter') {
      const fm = eq as FlowMeterData;
      statusText = `流量: ${fm.instantFlow.toFixed(1)}m³/h | 累计: ${fm.totalFlow.toFixed(0)}m³`;
    } else {
      statusText = `状态: ${isAlarm ? '异常' : '正常'}`;
    }

    return (
      <Html position={[0, 2.25, 0]} center zIndexRange={[36, 0]} distanceFactor={18}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.72)',
          border: `1px solid ${statusColor}`,
          borderRadius: '4px',
          padding: '3px 7px',
          color: '#fff',
          fontSize: '8px',
          fontFamily: 'sans-serif',
          boxShadow: `0 2px 6px rgba(0,0,0,0.28), 0 0 5px ${statusColor}24`,
          whiteSpace: 'nowrap',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          pointerEvents: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: statusColor,
              display: 'inline-block',
              boxShadow: `0 0 6px ${statusColor}`
            }} />
            <span style={{ color: '#94a3b8' }}>[核查]</span> {eq.name}
          </div>
          <div className="digit-font" style={{ color: isAlarm ? '#fca5a5' : '#4ade80', fontWeight: '600' }}>
            {statusText}
          </div>
        </div>
      </Html>
    );
  };

  return (
    <group ref={groupRef} scale={[S, S, S]}>
      {/* Floating Inspection Speech Bubble */}
      {renderSpeechBubble()}

      {/* === LEFT LEG ASSEMBLY (HIP JOINT PIVOT AT Y=0.8) === */}
      <group ref={leftLegRef} position={[-0.11, 0.8, 0]}>
        {/* Thigh (Upper Leg) */}
        <mesh castShadow position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.068, 0.058, 0.42, 14]} />
          <meshStandardMaterial color={pantsColor} roughness={0.7} />
        </mesh>
        {/* Cargo pocket and front seam break up the cylindrical leg silhouette. */}
        <mesh position={[-0.058, -0.22, 0.03]} rotation={[0, 0, 0.06]} castShadow>
          <boxGeometry args={[0.012, 0.13, 0.07]} />
          <meshStandardMaterial color="#1E2938" roughness={0.9} />
        </mesh>
        <mesh position={[0.002, -0.18, 0.068]}>
          <boxGeometry args={[0.012, 0.31, 0.006]} />
          <meshStandardMaterial color="#111827" roughness={0.86} />
        </mesh>
        {/* Knee joint sphere */}
        <mesh position={[0, -0.4, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={pantsColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.395, 0.055]} rotation={[0.18, 0, 0]} castShadow>
          <boxGeometry args={[0.115, 0.105, 0.018]} />
          <meshStandardMaterial color="#1B2430" roughness={0.88} />
        </mesh>

        {/* Shin (Lower Leg) Assembly (Pivot at Y=-0.4) */}
        <group ref={leftShinRef} position={[0, -0.4, 0]}>
          {/* Calf cylinder */}
          <mesh castShadow position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.056, 0.05, 0.42, 14]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} />
          </mesh>
          {/* Boot top collar */}
          <mesh position={[0, -0.32, 0.01]}>
            <cylinderGeometry args={[0.068, 0.068, 0.06, 10]} />
            <meshStandardMaterial color="#451a03" roughness={0.8} />
          </mesh>
          {/* Boot foot */}
          <mesh castShadow position={[0, -0.36, 0.035]}>
            <boxGeometry args={[0.13, 0.09, 0.22]} />
            <meshStandardMaterial color="#5c4033" roughness={0.8} />
          </mesh>
          {/* Boot thick sole */}
          <mesh castShadow position={[0, -0.41, 0.035]}>
            <boxGeometry args={[0.14, 0.03, 0.23]} />
            <meshStandardMaterial color="#1a0f0a" roughness={0.9} />
          </mesh>
          {[-0.07, -0.025, 0.02, 0.065].map((z, i) => (
            <mesh key={`left-boot-tread-${i}`} position={[0, -0.432, z]}>
              <boxGeometry args={[0.13, 0.012, 0.014]} />
              <meshStandardMaterial color="#0B0705" roughness={0.96} />
            </mesh>
          ))}
          {/* Boot steel toe cap */}
          <mesh castShadow position={[0, -0.37, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[0.06, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      </group>

      {/* === RIGHT LEG ASSEMBLY (HIP JOINT PIVOT AT Y=0.8) === */}
      <group ref={rightLegRef} position={[0.11, 0.8, 0]}>
        {/* Thigh (Upper Leg) */}
        <mesh castShadow position={[0, -0.2, 0]}>
          <cylinderGeometry args={[0.068, 0.058, 0.42, 14]} />
          <meshStandardMaterial color={pantsColor} roughness={0.7} />
        </mesh>
        {/* Cargo pocket and front seam break up the cylindrical leg silhouette. */}
        <mesh position={[0.058, -0.22, 0.03]} rotation={[0, 0, -0.06]} castShadow>
          <boxGeometry args={[0.012, 0.13, 0.07]} />
          <meshStandardMaterial color="#1E2938" roughness={0.9} />
        </mesh>
        <mesh position={[-0.002, -0.18, 0.068]}>
          <boxGeometry args={[0.012, 0.31, 0.006]} />
          <meshStandardMaterial color="#111827" roughness={0.86} />
        </mesh>
        {/* Knee joint sphere */}
        <mesh position={[0, -0.4, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color={pantsColor} roughness={0.7} />
        </mesh>
        <mesh position={[0, -0.395, 0.055]} rotation={[0.18, 0, 0]} castShadow>
          <boxGeometry args={[0.115, 0.105, 0.018]} />
          <meshStandardMaterial color="#1B2430" roughness={0.88} />
        </mesh>

        {/* Shin (Lower Leg) Assembly (Pivot at Y=-0.4) */}
        <group ref={rightShinRef} position={[0, -0.4, 0]}>
          {/* Calf cylinder */}
          <mesh castShadow position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.056, 0.05, 0.42, 14]} />
            <meshStandardMaterial color={pantsColor} roughness={0.7} />
          </mesh>
          {/* Boot top collar */}
          <mesh position={[0, -0.32, 0.01]}>
            <cylinderGeometry args={[0.068, 0.068, 0.06, 10]} />
            <meshStandardMaterial color="#451a03" roughness={0.8} />
          </mesh>
          {/* Boot foot */}
          <mesh castShadow position={[0, -0.36, 0.035]}>
            <boxGeometry args={[0.13, 0.09, 0.22]} />
            <meshStandardMaterial color="#5c4033" roughness={0.8} />
          </mesh>
          {/* Boot thick sole */}
          <mesh castShadow position={[0, -0.41, 0.035]}>
            <boxGeometry args={[0.14, 0.03, 0.23]} />
            <meshStandardMaterial color="#1a0f0a" roughness={0.9} />
          </mesh>
          {[-0.07, -0.025, 0.02, 0.065].map((z, i) => (
            <mesh key={`right-boot-tread-${i}`} position={[0, -0.432, z]}>
              <boxGeometry args={[0.13, 0.012, 0.014]} />
              <meshStandardMaterial color="#0B0705" roughness={0.96} />
            </mesh>
          ))}
          {/* Boot steel toe cap */}
          <mesh castShadow position={[0, -0.37, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
            <sphereGeometry args={[0.06, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#64748b" roughness={0.3} metalness={0.8} />
          </mesh>
        </group>
      </group>

      {/* === STATIC UTILITY BELT (PELVIS LEVEL) === */}
      <mesh castShadow position={[0, 0.82, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.065, 12]} />
        <meshStandardMaterial color="#3f2c1d" roughness={0.85} />
      </mesh>
      {/* Brass buckle */}
      <mesh castShadow position={[0, 0.82, 0.165]}>
        <boxGeometry args={[0.065, 0.05, 0.015]} />
        <meshStandardMaterial color="#d4af37" roughness={0.25} metalness={0.9} />
      </mesh>
      {/* Belt attachment 1: Walkie Talkie */}
      <group position={[-0.14, 0.83, -0.06]} rotation={[0, 0.2, 0.15]}>
        <mesh castShadow>
          <boxGeometry args={[0.045, 0.1, 0.03]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} />
        </mesh>
        {/* Antenna */}
        <mesh position={[-0.015, 0.07, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.06, 6]} />
          <meshStandardMaterial color="#0f172a" roughness={0.7} />
        </mesh>
      </group>
      {/* Belt attachment 2: Tool pouch */}
      <group position={[0.13, 0.78, 0.05]} rotation={[0.05, 0, -0.1]}>
        <mesh castShadow>
          <boxGeometry args={[0.05, 0.12, 0.095]} />
          <meshStandardMaterial color="#451a03" roughness={0.9} />
        </mesh>
        {/* Metal tools peeking out */}
        <mesh position={[0, 0.07, -0.02]} rotation={[0.2, 0, 0.3]}>
          <cylinderGeometry args={[0.008, 0.008, 0.08, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.07, 0.02]} rotation={[-0.1, 0, -0.2]}>
          <boxGeometry args={[0.012, 0.08, 0.02]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
        </mesh>
      </group>
      {/* Belt attachment 3: Flashlight */}
      <mesh castShadow position={[-0.07, 0.76, -0.13]} rotation={[0.2, -0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.018, 0.13, 8]} />
        <meshStandardMaterial color="#475569" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* === UPPER BODY GROUP (PIVOTS AT Y=0.8 TO ALLOW BOBBING & BENDING) === */}
      <group ref={upperBodyRef} position={[0, 0.8, 0]}>
        
        {/* Raincoat Hood (only in rain) */}
        {isRainy && (
          <mesh position={[0, 0.48, -0.12]} rotation={[-0.45, 0, 0]} castShadow>
            <sphereGeometry args={[0.13, 12, 12, 0, Math.PI * 2, 0, Math.PI / 1.7]} />
            <meshStandardMaterial color="#ea580c" roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
        )}

        {/* Tapered industrial shirt torso (wider shoulders) */}
        <mesh castShadow position={[0, 0.28, 0]}>
          <cylinderGeometry args={[0.18, 0.145, 0.54, 20]} />
          <meshStandardMaterial color={apparelColor} roughness={isRainy ? 0.34 : fabricRoughness} metalness={isRainy ? 0.1 : 0} />
        </mesh>
        
        {/* Shirt Collar */}
        <mesh position={[0, 0.54, 0]}>
          <cylinderGeometry args={[0.095, 0.095, 0.025, 16]} />
          <meshStandardMaterial color={collarColor} roughness={isRainy ? 0.3 : 0.6} />
        </mesh>

        {/* Safety vest front panels, kept as cloth slabs instead of a glowing full-body shell */}
        <mesh castShadow position={[-0.075, 0.28, 0.176]} rotation={[0, 0.04, 0]}>
          <boxGeometry args={[0.095, 0.48, 0.025]} />
          <meshStandardMaterial color={vestColor} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0.075, 0.28, 0.176]} rotation={[0, -0.04, 0]}>
          <boxGeometry args={[0.095, 0.48, 0.025]} />
          <meshStandardMaterial color={vestColor} roughness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 0.25, -0.165]}>
          <boxGeometry args={[0.31, 0.42, 0.025]} />
          <meshStandardMaterial color={vestColor} roughness={0.76} />
        </mesh>

        {/* Vest reflective strip: waist horizontal (top and bottom) */}
        <mesh position={[0, 0.17, 0.17]}>
          <boxGeometry args={[0.29, 0.024, 0.032]} />
          <meshStandardMaterial color="#dce4e8" roughness={0.22} metalness={0.45} />
        </mesh>
        <mesh position={[0, 0.36, 0.185]}>
          <boxGeometry args={[0.29, 0.024, 0.032]} />
          <meshStandardMaterial color="#dce4e8" roughness={0.22} metalness={0.45} />
        </mesh>

        {/* Vest reflective strip: Verticals / Suspenders (shoulder straps) */}
        <mesh position={[-0.09, 0.36, 0.165]} rotation={[0, 0, 0.1]}>
          <boxGeometry args={[0.024, 0.22, 0.032]} />
          <meshStandardMaterial color="#dce4e8" roughness={0.22} metalness={0.45} />
        </mesh>
        <mesh position={[0.09, 0.36, 0.165]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[0.024, 0.22, 0.032]} />
          <meshStandardMaterial color="#dce4e8" roughness={0.22} metalness={0.45} />
        </mesh>
        
        {/* Vest Zipper line */}
        <mesh position={[0, 0.28, 0.205]}>
          <boxGeometry args={[0.01, 0.45, 0.015]} />
          <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.8} />
        </mesh>

        {/* ID Card on left chest */}
        <group position={[-0.09, 0.38, 0.18]}>
          <mesh castShadow>
            <boxGeometry args={[0.05, 0.07, 0.012]} />
            <meshStandardMaterial color="#ffffff" roughness={0.9} />
          </mesh>
          {/* Card photo representation */}
          <mesh position={[-0.01, 0.01, 0.007]}>
            <boxGeometry args={[0.018, 0.022, 0.002]} />
            <meshStandardMaterial color="#1e3a8a" />
          </mesh>
          {/* Barcode line */}
          <mesh position={[0, -0.02, 0.007]}>
            <boxGeometry args={[0.035, 0.006, 0.002]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
        </group>

        {/* Neck */}
        <mesh castShadow position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.052, 0.055, 0.075, 14]} />
          <meshStandardMaterial color={skinColor} roughness={0.68} />
        </mesh>

        {/* === HEAD ASSEMBLY (PIVOTS AT Y=0.65 IN UPPER BODY) === */}
        <group ref={headRef} position={[0, 0.65, 0]}>
          {/* Head: narrower face with a separate back cranium so close-ups do not read as a ball. */}
          <mesh castShadow position={[0, 0.005, 0.055]} scale={[0.72, 1.02, 0.58]}>
            <sphereGeometry args={[0.12, 24, 18]} />
            <meshStandardMaterial color={skinColor} roughness={0.72} />
          </mesh>
          <mesh castShadow position={[0, 0.015, -0.035]} scale={[0.78, 1.0, 0.72]}>
            <sphereGeometry args={[0.105, 20, 16]} />
            <meshStandardMaterial color={skinColor} roughness={0.74} />
          </mesh>

          {/* Ears */}
          <mesh castShadow position={[-0.082, -0.002, 0.01]} scale={[0.36, 0.62, 0.28]}>
            <sphereGeometry args={[0.034, 12, 10]} />
            <meshStandardMaterial color={skinColor} roughness={0.76} />
          </mesh>
          <mesh castShadow position={[0.082, -0.002, 0.01]} scale={[0.36, 0.62, 0.28]}>
            <sphereGeometry args={[0.034, 12, 10]} />
            <meshStandardMaterial color={skinColor} roughness={0.76} />
          </mesh>

          {/* Nose and jaw give the face readable orientation in close-up */}
          <mesh castShadow position={[0, -0.006, 0.125]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.016, 0.044, 10]} />
            <meshStandardMaterial color="#c9865b" roughness={0.78} />
          </mesh>
          <mesh castShadow position={[0, -0.078, 0.052]} scale={[0.62, 0.28, 0.38]}>
            <sphereGeometry args={[0.07, 16, 10]} />
            <meshStandardMaterial color="#c98c62" roughness={0.78} />
          </mesh>

          {/* Low-profile safety glasses */}
          <group position={[0, 0.025, 0.115]}>
            <mesh position={[-0.038, 0, 0]}>
              <boxGeometry args={[0.052, 0.024, 0.01]} />
              <meshStandardMaterial color="#1e293b" transparent opacity={0.62} roughness={0.18} metalness={0.35} />
            </mesh>
            <mesh position={[0.038, 0, 0]}>
              <boxGeometry args={[0.052, 0.024, 0.01]} />
              <meshStandardMaterial color="#1e293b" transparent opacity={0.62} roughness={0.18} metalness={0.35} />
            </mesh>
            <mesh position={[0, 0, 0.004]}>
              <boxGeometry args={[0.026, 0.006, 0.01]} />
              <meshStandardMaterial color="#111827" roughness={0.35} metalness={0.5} />
            </mesh>
          </group>

          {/* Subtle facial detail: eyes, brows, mouth and hair shadow make the figure read as human instead of a toy head. */}
          <group position={[0, 0.027, 0.123]}>
            <mesh position={[-0.038, 0.002, 0.004]}>
              <boxGeometry args={[0.018, 0.006, 0.004]} />
              <meshStandardMaterial color="#111827" roughness={0.7} />
            </mesh>
            <mesh position={[0.038, 0.002, 0.004]}>
              <boxGeometry args={[0.018, 0.006, 0.004]} />
              <meshStandardMaterial color="#111827" roughness={0.7} />
            </mesh>
            <mesh position={[-0.04, 0.022, 0.003]} rotation={[0, 0, 0.1]}>
              <boxGeometry args={[0.042, 0.005, 0.004]} />
              <meshStandardMaterial color="#3F2A1C" roughness={0.78} />
            </mesh>
            <mesh position={[0.04, 0.022, 0.003]} rotation={[0, 0, -0.1]}>
              <boxGeometry args={[0.042, 0.005, 0.004]} />
              <meshStandardMaterial color="#3F2A1C" roughness={0.78} />
            </mesh>
          </group>
          <mesh position={[0, -0.052, 0.132]}>
            <boxGeometry args={[0.052, 0.005, 0.004]} />
            <meshStandardMaterial color="#6B3A2B" roughness={0.82} />
          </mesh>
          <mesh position={[0, -0.092, 0.092]} scale={[0.72, 0.14, 0.2]}>
            <sphereGeometry args={[0.075, 14, 8]} />
            <meshStandardMaterial color="#8A5A44" transparent opacity={0.26} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0, 0.074, -0.02]} scale={[0.82, 0.28, 0.62]}>
            <sphereGeometry args={[0.122, 18, 8, 0, Math.PI * 2, 0, Math.PI / 1.8]} />
            <meshStandardMaterial color="#2D2019" roughness={0.88} />
          </mesh>

          {/* Hard hat dome */}
          <mesh castShadow position={[0, 0.108, -0.012]} scale={[0.86, 0.58, 0.78]}>
            <sphereGeometry args={[0.145, 24, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#D8A90B" roughness={0.5} />
          </mesh>
          
          {/* Hard hat rim and front brim */}
          <mesh castShadow position={[0, 0.057, -0.012]} rotation={[Math.PI / 2, 0, 0]} scale={[0.86, 0.74, 1]}>
            <cylinderGeometry args={[0.152, 0.152, 0.014, 28]} />
            <meshStandardMaterial color="#B98508" roughness={0.52} />
          </mesh>
          <mesh castShadow position={[0, 0.049, 0.112]} scale={[0.78, 0.16, 0.32]}>
            <sphereGeometry args={[0.095, 18, 8]} />
            <meshStandardMaterial color="#B98508" roughness={0.54} />
          </mesh>

          {/* Helmet center rib */}
          <mesh position={[0, 0.13, -0.005]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.02, 0.045, 0.19]} />
            <meshStandardMaterial color="#A87906" roughness={0.58} />
          </mesh>
        </group>

        {/* === LEFT ARM ASSEMBLY (PIVOT AT SHOULDER [-0.25, 0.48, 0]) === */}
        <group ref={leftArmRef} position={[-0.25, 0.48, 0]}>
          {/* Shoulder joint */}
          <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color={apparelColor} roughness={0.5} />
          </mesh>
          {/* Shoulder pad */}
          <mesh position={[0.02, 0.02, 0]} rotation={[0, 0, -0.2]}>
            <boxGeometry args={[0.07, 0.03, 0.09]} />
            <meshStandardMaterial color={collarColor} roughness={0.5} />
          </mesh>
          {/* Upper Arm */}
          <mesh castShadow position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.042, 0.038, 0.255, 12]} />
            <meshStandardMaterial color={apparelColor} roughness={isRainy ? 0.34 : fabricRoughness} />
          </mesh>
          {/* Elbow joint sphere */}
          <mesh position={[0, -0.24, 0]}>
            <sphereGeometry args={[0.042, 8, 8]} />
            <meshStandardMaterial color={collarColor} roughness={0.55} />
          </mesh>

          {/* Forearm Assembly (Pivot at Y=-0.24) */}
          <group ref={leftForearmRef} position={[0, -0.24, 0]}>
            {/* Forearm cylinder */}
            <mesh castShadow position={[0, -0.1, 0.015]} rotation={[0.1, 0, 0]}>
              <cylinderGeometry args={[0.036, 0.032, 0.22, 12]} />
              <meshStandardMaterial color={apparelColor} roughness={isRainy ? 0.34 : fabricRoughness} />
            </mesh>
            {/* Wrist Cuff */}
            <mesh position={[0, -0.19, 0.02]}>
              <cylinderGeometry args={[0.042, 0.042, 0.02, 8]} />
              <meshStandardMaterial color="#243f46" roughness={0.68} />
            </mesh>
            {/* Hand (Nitrile safety glove - teal color) */}
            <mesh castShadow position={[0, -0.23, 0.025]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#315b63" roughness={0.68} />
            </mesh>
            {/* Glove thumb detail */}
            <mesh position={[0.025, -0.22, 0.035]} rotation={[0, 0.5, 0.5]}>
              <cylinderGeometry args={[0.012, 0.012, 0.03, 6]} />
              <meshStandardMaterial color="#315b63" roughness={0.68} />
            </mesh>
          </group>
        </group>

        {/* === RIGHT ARM + INSTRUMENTS ASSEMBLY (PIVOT AT SHOULDER [0.25, 0.48, 0]) === */}
        <group ref={rightArmRef} position={[0.25, 0.48, 0]}>
          {/* Shoulder joint */}
          <mesh castShadow position={[0, 0, 0]}>
            <sphereGeometry args={[0.055, 8, 8]} />
            <meshStandardMaterial color={apparelColor} roughness={0.5} />
          </mesh>
          {/* Shoulder pad */}
          <mesh position={[-0.02, 0.02, 0]} rotation={[0, 0, 0.2]}>
            <boxGeometry args={[0.07, 0.03, 0.09]} />
            <meshStandardMaterial color={collarColor} roughness={0.5} />
          </mesh>
          {/* Upper Arm */}
          <mesh castShadow position={[0, -0.12, 0]}>
            <cylinderGeometry args={[0.042, 0.038, 0.255, 12]} />
            <meshStandardMaterial color={apparelColor} roughness={isRainy ? 0.34 : fabricRoughness} />
          </mesh>
          {/* Elbow joint sphere */}
          <mesh position={[0, -0.24, 0]}>
            <sphereGeometry args={[0.042, 8, 8]} />
            <meshStandardMaterial color={collarColor} roughness={0.55} />
          </mesh>

          {/* Forearm Assembly (Pivot at Y=-0.24) */}
          <group ref={rightForearmRef} position={[0, -0.24, 0]}>
            {/* Forearm cylinder */}
            <mesh castShadow position={[0, -0.1, 0.015]} rotation={[0.1, 0, 0]}>
              <cylinderGeometry args={[0.036, 0.032, 0.22, 12]} />
              <meshStandardMaterial color={apparelColor} roughness={isRainy ? 0.34 : fabricRoughness} />
            </mesh>
            {/* Wrist Cuff */}
            <mesh position={[0, -0.19, 0.02]}>
              <cylinderGeometry args={[0.042, 0.042, 0.02, 8]} />
              <meshStandardMaterial color="#243f46" roughness={0.68} />
            </mesh>
            {/* Hand (Nitrile safety glove) */}
            <mesh castShadow position={[0, -0.23, 0.025]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#315b63" roughness={0.68} />
            </mesh>
            {/* Glove thumb detail */}
            <mesh position={[-0.025, -0.22, 0.035]} rotation={[0, -0.5, -0.5]}>
              <cylinderGeometry args={[0.012, 0.012, 0.03, 6]} />
              <meshStandardMaterial color="#315b63" roughness={0.68} />
            </mesh>

            {/* ============ INSTRUMENT VARIANT: CLIPBOARD ============ */}
            {variant === 'clipboard' && (
              <group position={[0, -0.25, 0.1]} rotation={[0.6, 0, 0]}>
                {/* Clipboard backing */}
                <mesh castShadow>
                  <boxGeometry args={[0.22, 0.28, 0.015]} />
                  <meshStandardMaterial color="#78350f" roughness={0.85} /> {/* Wooden backing */}
                </mesh>
                {/* White paper */}
                <mesh position={[0, 0.005, 0.009]}>
                  <boxGeometry args={[0.18, 0.24, 0.005]} />
                  <meshStandardMaterial color="#FAF9F6" roughness={0.9} />
                </mesh>
                {/* Paper grids text decoration */}
                <mesh position={[0, 0.005, 0.012]}>
                  <boxGeometry args={[0.14, 0.18, 0.001]} />
                  <meshStandardMaterial color="#a1a1aa" transparent opacity={0.6} roughness={1.0} />
                </mesh>
                {/* Metal clip */}
                <mesh position={[0, 0.12, 0.01]}>
                  <boxGeometry args={[0.07, 0.03, 0.015]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
                </mesh>
                {/* Tapping Pen */}
                <mesh ref={penRef} position={[0.08, -0.02, 0.02]} rotation={[-0.3, 0.1, 0.4]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.12, 6]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.7} />
                </mesh>
              </group>
            )}

            {/* ============ INSTRUMENT VARIANT: TABLET ============ */}
            {variant === 'tablet' && (
              <group position={[0, -0.24, 0.08]} rotation={[0.45, 0, 0]}>
                {/* Rugged Tablet casing */}
                <mesh castShadow>
                  <boxGeometry args={[0.18, 0.26, 0.02]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.7} />
                </mesh>
                {/* Bumper protective shell corners (orange) */}
                <mesh position={[0, 0, 0]}>
                  <boxGeometry args={[0.195, 0.24, 0.026]} />
                  <meshStandardMaterial color="#f97316" roughness={0.5} />
                </mesh>
                {/* Emissive Screen (glowing digital UI) */}
                <mesh position={[0, 0, 0.012]}>
                  <boxGeometry args={[0.15, 0.22, 0.004]} />
                  <meshStandardMaterial 
                    color="#06b6d4" 
                    emissive="#06b6d4" 
                    emissiveIntensity={0.8} 
                    roughness={0.1} 
                  />
                </mesh>
              </group>
            )}

            {/* ============ INSTRUMENT VARIANT: SCANNING ============ */}
            {variant === 'scanning' && (
              <group position={[0, -0.24, 0.08]} rotation={[0.3, 0, 0]}>
                {/* Handheld infrared gas scanner */}
                <mesh castShadow>
                  <boxGeometry args={[0.07, 0.14, 0.07]} />
                  <meshStandardMaterial color="#eab308" roughness={0.4} />
                </mesh>
                {/* Grip */}
                <mesh position={[0, -0.04, 0]}>
                  <boxGeometry args={[0.08, 0.04, 0.08]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.8} />
                </mesh>
                {/* Metal nozzle */}
                <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.012, 0.02, 0.07, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.15} />
                </mesh>
                <mesh ref={scannerBeamRef} visible={false} position={[0, 0.12, 0.04]}>
                  <boxGeometry args={[0.02, 0.02, 0.02]} />
                  <meshBasicMaterial color="#ef4444" />
                </mesh>
              </group>
            )}

            {/* ============ INSTRUMENT VARIANT: PROBE ============ */}
            {variant === 'probe' && (
              <group position={[0, -0.24, 0.08]}>
                {/* Stainless steel chemical detector probe */}
                <mesh castShadow rotation={[0.5, 0, -0.1]}>
                  <cylinderGeometry args={[0.007, 0.007, 0.44, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
                </mesh>
                {/* Black sensor head */}
                <mesh position={[0, -0.2, 0.11]} rotation={[0.5, 0, -0.1]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.05, 8]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.8} />
                </mesh>
                {/* Flex cable */}
                <mesh ref={probeCableRef} position={[-0.08, -0.08, -0.04]} rotation={[0.2, 0, 0.7]}>
                  <cylinderGeometry args={[0.005, 0.005, 0.3, 6]} />
                  <meshStandardMaterial color="#0f172a" roughness={0.9} />
                </mesh>
              </group>
            )}
          </group>
        </group>

      </group>

    </group>
  );
};
