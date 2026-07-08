import { forwardRef, useCallback, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';

/** 绑定到 R3F events.connected（与 Canvas eventSource 一致），canvas 设 pointer-events:none 时仍可旋转。 */
type Props = Omit<React.ComponentProps<typeof OrbitControls>, 'domElement'> & {
  onNavigateStart?: () => void;
  onNavigateEnd?: () => void;
};

export const OrbitControlsFixed = forwardRef<OrbitControlsImpl, Props>(function OrbitControlsFixed(
  { onNavigateStart, onNavigateEnd, ...props },
  ref,
) {
  const gl = useThree((s) => s.gl);
  const connected = useThree((s) => s.events.connected);
  const domElement = (connected as HTMLElement | undefined) ?? gl.domElement;
  const endTimer = useRef<number | null>(null);

  const handleStart = useCallback(() => {
    if (endTimer.current !== null) {
      window.clearTimeout(endTimer.current);
      endTimer.current = null;
    }
    onNavigateStart?.();
  }, [onNavigateStart]);

  const handleEnd = useCallback(() => {
    if (endTimer.current !== null) window.clearTimeout(endTimer.current);
    endTimer.current = window.setTimeout(() => {
      endTimer.current = null;
      onNavigateEnd?.();
    }, 120);
  }, [onNavigateEnd]);

  return (
    <OrbitControls
      ref={ref}
      domElement={domElement}
      makeDefault
      enableDamping={false}
      onStart={handleStart}
      onEnd={handleEnd}
      {...props}
    />
  );
});
