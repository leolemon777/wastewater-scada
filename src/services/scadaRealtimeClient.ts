import type { PureWaterPlcTelemetry } from '../store/pureWaterPlc';
import {
  M100_SNAPSHOT_MESSAGE_TYPE,
  M100_SOURCE_IDS,
  type M100SourceId,
  type M100TelemetryFrame,
  normalizeM100Telemetry,
} from '../store/m100Realtime';

const PURE_WATER_SOURCE_ID = 'purewater-plc-01';
const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 10_000, 15_000] as const;

type JsonObject = Record<string, unknown>;

interface ScadaEnvelope {
  schema: string;
  messageType: string;
  sourceId: string;
  payload: unknown;
}

export interface M100DecodedMessage {
  sourceId: M100SourceId;
  telemetry: M100TelemetryFrame;
}

export interface ScadaRealtimeClientOptions {
  url?: string;
  onPureWaterTelemetry: (telemetry: PureWaterPlcTelemetry) => void;
  onM100Telemetry?: (message: M100DecodedMessage) => void;
}

export interface ScadaRealtimeClient {
  start: () => void;
  stop: () => void;
}

const isObject = (value: unknown): value is JsonObject => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const finiteNumber = (value: unknown): number | undefined => (
  typeof value === 'number' && Number.isFinite(value) ? value : undefined
);

const cleanBits = (value: unknown): Readonly<Record<string, boolean | 0 | 1 | null>> | undefined => {
  if (!isObject(value)) return undefined;
  const result: Record<string, boolean | 0 | 1 | null> = {};
  for (const [address, pointValue] of Object.entries(value)) {
    if (pointValue === true || pointValue === false || pointValue === 0 || pointValue === 1 || pointValue === null) {
      result[address] = pointValue;
    }
  }
  return result;
};

const cleanWords = (value: unknown): Readonly<Record<string, number | null>> | undefined => {
  if (!isObject(value)) return undefined;
  const result: Record<string, number | null> = {};
  for (const [address, pointValue] of Object.entries(value)) {
    if (pointValue === null || (typeof pointValue === 'number' && Number.isFinite(pointValue))) {
      result[address] = pointValue;
    }
  }
  return result;
};

const cleanRawWords = (value: unknown): Readonly<Record<string, number | null>> | undefined => {
  if (!isObject(value)) return undefined;
  const result: Record<string, number | null> = {};
  for (const [address, pointValue] of Object.entries(value)) {
    if (pointValue === null || (typeof pointValue === 'number' && Number.isFinite(pointValue))) {
      result[address] = pointValue;
    }
  }
  return result;
};

const parseEnvelope = (raw: string): ScadaEnvelope | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isObject(parsed)
    || parsed.schema !== 'scada.v1'
    || typeof parsed.messageType !== 'string'
    || typeof parsed.sourceId !== 'string') {
    return null;
  }

  return parsed as unknown as ScadaEnvelope;
};

/** Convert a reviewed Hub event into the existing Zustand ingestion payload. */
export function decodeScadaRealtimeMessage(raw: string): PureWaterPlcTelemetry | null {
  const envelope = parseEnvelope(raw);
  if (!envelope || envelope.sourceId !== PURE_WATER_SOURCE_ID || !isObject(envelope.payload)) return null;

  const payload = envelope.payload;
  const enabled = typeof payload.enabled === 'boolean' ? payload.enabled : true;
  const adapterLabel = typeof payload.adapterLabel === 'string' ? payload.adapterLabel : undefined;
  const receivedAt = finiteNumber(payload.receivedAt);
  const sequence = finiteNumber(payload.sequence);

  if (envelope.messageType === 'source.status') {
    if (payload.connected !== false) return null;
    return {
      enabled,
      connected: false,
      ...(adapterLabel ? { adapterLabel } : {}),
      ...(receivedAt !== undefined ? { receivedAt } : {}),
      ...(sequence !== undefined ? { sequence } : {}),
    };
  }

  if (envelope.messageType !== 'purewater.plc.snapshot' || typeof payload.connected !== 'boolean') {
    return null;
  }

  const bits = cleanBits(payload.bits);
  const words = cleanWords(payload.words);
  const rawWords = cleanRawWords(payload.rawWords);

  return {
    enabled,
    connected: payload.connected,
    ...(adapterLabel ? { adapterLabel } : {}),
    ...(receivedAt !== undefined ? { receivedAt } : {}),
    ...(sequence !== undefined ? { sequence } : {}),
    ...(bits ? { bits } : {}),
    ...(words ? { words } : {}),
    ...(rawWords ? { rawWords } : {}),
  };
}

/** 解码 M100 网关（气浮/地下池）信封；不匹配返回 null。 */
export function decodeM100RealtimeMessage(raw: string): M100DecodedMessage | null {
  const envelope = parseEnvelope(raw);
  if (!envelope || !M100_SOURCE_IDS.includes(envelope.sourceId) || !isObject(envelope.payload)) return null;

  const payload = envelope.payload;
  const enabled = typeof payload.enabled === 'boolean' ? payload.enabled : true;

  if (envelope.messageType === 'source.status') {
    if (payload.connected !== false) return null;
    return {
      sourceId: envelope.sourceId as M100SourceId,
      telemetry: { enabled, connected: false },
    };
  }

  if (envelope.messageType !== M100_SNAPSHOT_MESSAGE_TYPE) return null;

  const telemetry = normalizeM100Telemetry(payload);
  if (!telemetry || typeof payload.connected !== 'boolean') return null;

  return { sourceId: envelope.sourceId as M100SourceId, telemetry };
}

export function getDefaultScadaHubWebSocketUrl(): string {
  const configured = import.meta.env.VITE_SCADA_HUB_WS_URL?.trim();
  return configured || 'ws://127.0.0.1:18080/ws/scada';
}

export function createScadaRealtimeClient(options: ScadaRealtimeClientOptions): ScadaRealtimeClient {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let stopped = true;
  let configuredSourceSeen = false;
  let disconnectReported = false;
  const seenM100Sources = new Set<string>();
  const m100DisconnectReported = new Set<string>();

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const reportTelemetry = (telemetry: PureWaterPlcTelemetry) => {
    if (telemetry.enabled === false) return;
    configuredSourceSeen = true;
    disconnectReported = telemetry.connected === false;
    options.onPureWaterTelemetry(telemetry);
  };

  const reportM100Telemetry = (message: M100DecodedMessage) => {
    if (message.telemetry.enabled === false) return;
    seenM100Sources.add(message.sourceId);
    if (message.telemetry.connected === false) {
      m100DisconnectReported.add(message.sourceId);
    } else {
      m100DisconnectReported.delete(message.sourceId);
    }
    options.onM100Telemetry?.(message);
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== null) return;
    const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (stopped || socket) return;

    try {
      const nextSocket = new WebSocket(options.url ?? getDefaultScadaHubWebSocketUrl());
      socket = nextSocket;

      nextSocket.onopen = () => {
        reconnectAttempt = 0;
      };

      nextSocket.onmessage = (event) => {
        if (typeof event.data !== 'string') return;
        const telemetry = decodeScadaRealtimeMessage(event.data);
        if (telemetry) {
          reportTelemetry(telemetry);
          return;
        }
        const m100Message = decodeM100RealtimeMessage(event.data);
        if (m100Message) reportM100Telemetry(m100Message);
      };

      nextSocket.onerror = () => {
        nextSocket.close();
      };

      nextSocket.onclose = () => {
        if (socket === nextSocket) socket = null;
        if (!stopped && configuredSourceSeen && !disconnectReported) {
          disconnectReported = true;
          options.onPureWaterTelemetry({ connected: false });
        }
        for (const sourceId of seenM100Sources) {
          if (!stopped && !m100DisconnectReported.has(sourceId)) {
            m100DisconnectReported.add(sourceId);
            options.onM100Telemetry?.({ sourceId: sourceId as M100SourceId, telemetry: { enabled: true, connected: false } });
          }
        }
        scheduleReconnect();
      };
    } catch {
      socket = null;
      scheduleReconnect();
    }
  };

  return {
    start: () => {
      if (!stopped) return;
      stopped = false;
      connect();
    },
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearReconnectTimer();
      const activeSocket = socket;
      socket = null;
      if (activeSocket && activeSocket.readyState < WebSocket.CLOSING) {
        activeSocket.close(1000, 'SCADA UI stopped');
      }
    },
  };
}
