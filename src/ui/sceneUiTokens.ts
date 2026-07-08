/**
 * Overlay UI tokens — bright daylight chrome over the outdoor 3D scene.
 * Light frosted bar + slate typography; blue accent for active controls.
 */
export interface SceneUiTokenSet {
  bgBase: string;
  bgPanel: string;
  bgElevated: string;
  bgSubtle: string;
  bgInset: string;
  bgBorder: string;
  textPrimary: string;
  textSecondary: string;
  textDim: string;
  accent: string;
  accentMuted: string;
  accentWarm: string;
  topbarBg: string;
  topbarBorder: string;
  skyTint: string;
}

/** Premium daylight SCADA chrome — crisp white rail, slate type, ocean accent. */
export const BRIGHT_DAYLIGHT_UI: SceneUiTokenSet = {
  bgBase: '#EEF2F6',
  bgPanel: 'rgba(255, 255, 255, 0.96)',
  bgElevated: '#FFFFFF',
  bgSubtle: '#F5F7FA',
  bgInset: '#E8EDF3',
  bgBorder: 'rgba(15, 23, 42, 0.08)',
  textPrimary: '#0F172A',
  textSecondary: '#334155',
  textDim: '#64748B',
  accent: '#0369A1',
  accentMuted: '#0284C7',
  accentWarm: '#C2410C',
  topbarBg: 'rgba(255, 255, 255, 0.96)',
  topbarBorder: 'rgba(15, 23, 42, 0.06)',
  skyTint: '#D8EAF7',
};

export function resolveSceneUiTokens(): SceneUiTokenSet {
  return BRIGHT_DAYLIGHT_UI;
}

export function applySceneUiTokens(): void {
  const t = BRIGHT_DAYLIGHT_UI;
  const root = document.documentElement;
  root.dataset.scenePalette = 'bright';
  root.dataset.dayNight = 'day';
  root.dataset.sceneChrome = 'bright-daylight';

  root.style.setProperty('--bg-base', t.bgBase);
  root.style.setProperty('--bg-panel', t.bgPanel);
  root.style.setProperty('--bg-elevated', t.bgElevated);
  root.style.setProperty('--bg-subtle', t.bgSubtle);
  root.style.setProperty('--bg-inset', t.bgInset);
  root.style.setProperty('--bg-panel-border', t.bgBorder);
  root.style.setProperty('--text-primary', t.textPrimary);
  root.style.setProperty('--text-secondary', t.textSecondary);
  root.style.setProperty('--text-dim', t.textDim);
  root.style.setProperty('--accent-primary', t.accent);
  root.style.setProperty('--accent-neutral', t.accentMuted);
  root.style.setProperty('--accent-warm', t.accentWarm);
  root.style.setProperty('--topbar-bg', t.topbarBg);
  root.style.setProperty('--topbar-border', t.topbarBorder);
  root.style.setProperty('--scene-sky-tint', t.skyTint);
  root.style.setProperty('--accent-blue', t.accent);
  root.style.setProperty('--accent-teal', '#0D9488');
  root.style.setProperty('--accent-data-a', t.accent);
  root.style.setProperty('--accent-data-b', t.accentWarm);
  root.style.setProperty('--topbar-text', t.textPrimary);
  root.style.setProperty('--topbar-text-dim', t.textSecondary);

  root.style.setProperty('--glass-text-primary', t.textPrimary);
  root.style.setProperty('--glass-text-secondary', t.textSecondary);
  root.style.setProperty('--glass-text-dim', t.textDim);
  root.style.setProperty('--glass-text-shadow', 'none');
  root.style.setProperty('--glass-text-shadow-soft', 'none');

  root.style.setProperty('--glass-fill-bar', 'rgba(255, 255, 255, 0.96)');
  root.style.setProperty('--glass-fill-panel', 'rgba(255, 255, 255, 0.98)');
  root.style.setProperty('--glass-fill-dock', 'rgba(245, 247, 250, 0.92)');
  root.style.setProperty('--glass-fill-nested', '#F1F5F9');
  root.style.setProperty('--glass-fill-nested-hover', '#FFFFFF');
  root.style.setProperty('--glass-fill-veil', 'rgba(248, 250, 252, 0.94)');

  root.style.setProperty('--glass-border', 'rgba(15, 23, 42, 0.08)');
  root.style.setProperty('--glass-border-soft', 'rgba(15, 23, 42, 0.06)');
  root.style.setProperty('--glass-border-bright', 'rgba(255, 255, 255, 1)');
  root.style.setProperty('--glass-border-accent', 'rgba(3, 105, 161, 0.28)');
  root.style.setProperty('--glass-highlight', 'rgba(255, 255, 255, 1)');

  root.style.setProperty('--glass-blur', '20px');
  root.style.setProperty('--glass-blur-dock', '16px');
  root.style.setProperty('--glass-blur-panel', '22px');
  root.style.setProperty('--glass-blur-nested', '12px');
  root.style.setProperty('--glass-saturate', '120%');

  root.style.setProperty('--glass-shadow', '0 8px 28px rgba(15, 23, 42, 0.07), inset 0 1px 0 rgba(255, 255, 255, 1)');
  root.style.setProperty('--glass-shadow-soft', '0 2px 8px rgba(15, 23, 42, 0.05)');
  root.style.setProperty('--shadow-topbar', '0 1px 0 rgba(15, 23, 42, 0.05), 0 6px 20px rgba(15, 23, 42, 0.05)');

  root.style.setProperty('--chrome-surface', t.bgPanel);
  root.style.setProperty('--chrome-raised', t.bgElevated);
  root.style.setProperty('--chrome-sunken', t.bgInset);
  root.style.setProperty('--chrome-border', t.bgBorder);
  root.style.setProperty('--chrome-edge', 'rgba(255, 255, 255, 0.9)');

  root.style.setProperty('--status-ok', '#16A34A');
  root.style.setProperty('--status-warn', '#D97706');
  root.style.setProperty('--status-error', '#DC2626');
  root.style.setProperty('--status-off', '#94A3B8');

  root.style.setProperty('--glass-fill-ok', 'rgba(22, 163, 74, 0.12)');
  root.style.setProperty('--glass-fill-warn', 'rgba(217, 119, 6, 0.12)');
  root.style.setProperty('--glass-fill-error', 'rgba(220, 38, 38, 0.1)');
}
