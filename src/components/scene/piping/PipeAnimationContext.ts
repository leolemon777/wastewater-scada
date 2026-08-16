import { createContext } from 'react';

/** Section-level gate used to freeze flow animation when its telemetry is not current. */
export const PipeAnimationContext = createContext(true);
