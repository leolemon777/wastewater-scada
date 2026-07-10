import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Preload, useProgress } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { EffectComposer } from '@react-three/postprocessing';
// Lazy-load the heavy 3D scene so the three/drei vendor bundles split off from
// the initial UI shell and only load when the canvas mounts.
const SCADAScene = lazy(() =>
  import('./components/3d/SCADAScene').then((m) => ({ default: m.SCADAScene })),
);
import { OrbitControlsFixed } from './components/canvas/OrbitControlsFixed';
import { OverlayUI } from './components/ui/Overlay';
import { useScadaStore } from './store/useScadaStore';
import { ErrorBoundary } from './ErrorBoundary';

/**
 * Full-screen loading overlay shown until the WebGL canvas renders its first
 * frame. Prevents the white flash that happens between React mount and the
 * first R3F frame. Uses drei's useProgress for asset-loaded percentage and a
 * short floor so the bar never jumps from 0→100 instantly.
 */
const SceneLoader = ({ done }: { done: boolean }) => {
  const { progress } = useProgress();
  const [dismissed, setDismissed] = useState(false);
  const shown = done ? 100 : Math.max(8, Math.min(99, Math.round(progress)));

  useEffect(() => {
    const timer = window.setTimeout(() => setDismissed(true), 1400);
    return () => window.clearTimeout(timer);
  }, []);

  if (done || dismissed) return null;
  return (
    <div className="scene-loader" role="status" aria-live="polite">
      <div className="scene-loader-card">
        <div className="scene-loader-title">污水站现场监控系统</div>
        <div className="scene-loader-sub">正在初始化 3D 现场…</div>
        <div className="scene-loader-track">
          <div className="scene-loader-fill" style={{ width: `${shown}%` }} />
        </div>
        <div className="digit-font scene-loader-pct">{shown}%</div>
      </div>
    </div>
  );
};

declare global {
  interface Window {
    __scadaSetCamera?: (view: { target: [number, number, number]; position: [number, number, number] }) => void;
  }
}

// Keep the 3D scene sharp. Do not lower DPR for performance; optimize UI
// compositing and interaction instead so text, pipes and equipment edges stay crisp.
function getCanvasDpr(performanceMode: boolean): number {
  if (typeof window === 'undefined') return 1;
  const deviceDpr = window.devicePixelRatio || 1;
  if (performanceMode) return Math.min(deviceDpr, 1.5);
  return Math.min(Math.max(deviceDpr, 2), 2);
}

function parseVectorParam(value: string | null): [number, number, number] | null {
  if (!value) return null;
  const parts = value.split(',').map(Number);
  return parts.length === 3 && parts.every(Number.isFinite)
    ? [parts[0], parts[1], parts[2]]
    : null;
}

function shouldUseCompactOverlay(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get('uiDensity') === 'full') return false;
  if (params.get('uiDensity') === 'compact') return true;
  // Keep compact mode for narrow layouts only; desktop SCADA should stay readable.
  return window.innerWidth <= 1280;
}

function getOverlayScale(): number {
  // Always 1: the previous 0.92/0.96/0.98 non-integer transform scales caused
  // sub-pixel interpolation that made the whole overlay (text/borders/icons)
  // look blurry on high-DPR displays. Crispness > shaving a few pixels of space.
  return 1;
}

function shouldUseLowLatencyUi(): boolean {
  if (typeof window === 'undefined') return true;
  const params = new URLSearchParams(window.location.search);
  // Use ?uiEffects=glass only when you want the heavier frosted-glass look for screenshots.
  // Runtime operation defaults to clear-mode to avoid WebGL + backdrop-filter compositor stalls.
  return params.get('uiEffects') !== 'glass';
}

function App() {
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);
  const canvasShellRef = useRef<HTMLDivElement>(null!);
  const currentView = useScadaStore((state) => state.currentView);
  const demoMode = useScadaStore((state) => state.demoMode);
  const applyDemoTick = useScadaStore((state) => state.applyDemoTick);
  const [sceneReady, setSceneReady] = useState(false);
  const performanceMode = useScadaStore((state) => state.performanceMode);
  const canvasDpr = getCanvasDpr(performanceMode);

  useEffect(() => {
    if (!shouldUseLowLatencyUi()) return;
    document.body.classList.add('clear-mode');
    return () => {
      document.body.classList.remove('clear-mode');
    };
  }, []);

  // Never block overlay UI indefinitely if WebGL init stalls (perf mode / GPU issues).
  useEffect(() => {
    const fallback = window.setTimeout(() => setSceneReady(true), 12000);
    return () => window.clearTimeout(fallback);
  }, []);

  useEffect(() => {
    if (!demoMode) return;
    applyDemoTick();
    const timer = window.setInterval(applyDemoTick, 3000);
    return () => window.clearInterval(timer);
  }, [applyDemoTick, demoMode]);

  useEffect(() => {
    const updateDensity = () => {
      const overlayScale = getOverlayScale();
      document.documentElement.dataset.uiDensity = shouldUseCompactOverlay() ? 'compact' : 'full';
      document.documentElement.style.setProperty('--overlay-scale', overlayScale.toFixed(2));
      document.documentElement.style.setProperty('--view-preset-scale', overlayScale.toFixed(2));
      document.documentElement.style.setProperty('--zoom-tool-scale', overlayScale.toFixed(2));
    };

    updateDensity();
    window.addEventListener('resize', updateDensity);
    window.visualViewport?.addEventListener('resize', updateDensity);
    return () => {
      window.removeEventListener('resize', updateDensity);
      window.visualViewport?.removeEventListener('resize', updateDensity);
      delete document.documentElement.dataset.uiDensity;
      document.documentElement.style.removeProperty('--overlay-scale');
      document.documentElement.style.removeProperty('--view-preset-scale');
      document.documentElement.style.removeProperty('--zoom-tool-scale');
    };
  }, []);

  useEffect(() => {
    const setCamera = ({ target, position }: { target: [number, number, number]; position: [number, number, number] }) => {
      const controls = orbitControlsRef.current;
      if (!controls) return false;
      controls.target.set(...target);
      controls.object.position.set(...position);
      controls.update();
      return true;
    };

    window.__scadaSetCamera = (view) => {
      setCamera(view);
    };
    return () => {
      delete window.__scadaSetCamera;
    };
  }, []);

  useEffect(() => {
    const handleSetCamera = (event: Event) => {
      const controls = orbitControlsRef.current;
      const detail = (event as CustomEvent<{ target?: [number, number, number]; position?: [number, number, number] }>).detail;
      if (!controls || !detail?.target || !detail?.position) return;
      controls.target.set(...detail.target);
      controls.object.position.set(...detail.position);
      controls.update();
    };

    document.addEventListener('scada:set-camera', handleSetCamera);
    return () => {
      document.removeEventListener('scada:set-camera', handleSetCamera);
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const target = parseVectorParam(params.get('qaTarget'));
    const position = parseVectorParam(params.get('qaPosition'));
    if (!target || !position) return;

    let frames = 0;
    let frameId = 0;
    const applyWhenReady = () => {
      const controls = orbitControlsRef.current;
      if (controls) {
        controls.target.set(...target);
        controls.object.position.set(...position);
        controls.update();
        return;
      }
      frames += 1;
      if (frames < 120) {
        frameId = requestAnimationFrame(applyWhenReady);
      }
    };

    frameId = requestAnimationFrame(applyWhenReady);
    return () => {
      cancelAnimationFrame(frameId);
    };
  }, []);

  return (
    <>
      <SceneLoader done={sceneReady} />
      <div
        ref={canvasShellRef}
        className={`scene-canvas-shell ${currentView === '3d' ? '' : 'hidden'}`}
      >
        <ErrorBoundary fallbackTitle="3D 场景渲染异常">
          <Canvas
            eventSource={canvasShellRef}
            shadows={"percentage"}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
            dpr={canvasDpr}
            frameloop="always"
            camera={{ position: [22, 18, 38], fov: 38 }}
            gl={{
              antialias: true,
              powerPreference: 'high-performance',
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 0.95,
            }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              const maxAniso = gl.capabilities.getMaxAnisotropy();
              THREE.Texture.DEFAULT_ANISOTROPY = Math.min(8, maxAniso);
              // Expose the renderer for perf diagnostics (draw-call counting).
              if (typeof window !== 'undefined') (window as unknown as { __scadaGl?: THREE.WebGLRenderer }).__scadaGl = gl;
              // First frame is about to render — let the loader fade out.
              requestAnimationFrame(() => setSceneReady(true));
            }}
          >
            <EffectComposer multisampling={4}><></></EffectComposer>
            {/* Lazy SCADAScene: while the dynamic import resolves, render nothing
                inside the canvas (the outer-DOM <SceneLoader> at top covers the
                loading screen). A DOM fallback here would crash R3F ("Div is not
                part of the THREE namespace"), so the in-canvas fallback is null. */}
            <Suspense fallback={null}>
              <SCADAScene />
            </Suspense>
            <OrbitControlsFixed
              ref={orbitControlsRef}
              target={[-6, 1, 0]}
              enableRotate={true}
              maxPolarAngle={Math.PI / 2.2}
              minPolarAngle={Math.PI / 6}
              enablePan
              enableZoom
              minDistance={8}
              maxDistance={120}
            />
            {!performanceMode && <Preload all />}
          </Canvas>
        </ErrorBoundary>
      </div>

      <ErrorBoundary fallbackTitle="UI 覆层异常">
        <OverlayUI orbitControlsRef={orbitControlsRef} />
      </ErrorBoundary>
    </>
  );
}

export default App;
