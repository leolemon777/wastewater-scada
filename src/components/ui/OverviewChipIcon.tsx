import type { SVGProps } from 'react';

/** 「运行总览」专用图标 — 仪表板 + 实时趋势 + LIVE 指示 */
export function OverviewChipIcon({
  size = 16,
  className,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <rect
        x="2.75"
        y="3.75"
        width="14.5"
        height="12.5"
        rx="2.75"
        stroke="currentColor"
        strokeWidth="1.35"
        opacity="0.92"
      />
      <path
        d="M6.25 13.1V10.4M9.25 13.1V8.6M12.25 13.1V9.8"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        opacity="0.72"
      />
      <path
        d="M5.5 14.75H14.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.28"
      />
      <path
        d="M5.5 11.2L7.35 9.55L9.1 10.85L11.05 8.35L12.75 9.55L14.5 8.1"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="15.35" cy="5.65" r="2.15" stroke="var(--accent-primary)" strokeWidth="1.15" opacity="0.95" />
      <circle cx="15.35" cy="5.65" r="0.85" fill="var(--accent-primary)" />
    </svg>
  );
}
