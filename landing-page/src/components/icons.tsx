import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 16, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconArrowUpRight = (p: P) => (
  <Svg {...p}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </Svg>
);

export const IconMenu = (p: P) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

/** Chrome 标志的单色剪影：外环 + 中心实心圆 + 三段 120° 分割线 */
export const IconChrome = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9.5" />
    <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    <path d="M12 16v5.5M8.5 10 3.8 7.3M15.5 10l4.7-2.7" />
  </Svg>
);

export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconStar = (p: P) => (
  <Svg {...p} fill="currentColor" stroke="none">
    <path d="M12 3.5l2.6 5.3 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.6l5.9-.8z" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p} strokeWidth={2.4}>
    <path d="M4.5 12.5l5 5L19.5 7" />
  </Svg>
);

export const IconBolt = (p: P) => (
  <Svg {...p}>
    <path d="M13 2 5 13h6l-1 9 8-11h-6z" />
  </Svg>
);

export const IconNetwork = (p: P) => (
  <Svg {...p}>
    <path d="M4 12h16" />
    <path d="m15 7 5 5-5 5" />
    <path d="m9 17-5-5 5-5" />
  </Svg>
);

export const IconConsole = (p: P) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m7 10 2.5 2.5L7 15M12 15h5" />
  </Svg>
);

export const IconCursor = (p: P) => (
  <Svg {...p}>
    <path d="m5 3 6.5 16 2.2-6.3L20 10.5z" />
  </Svg>
);

export const IconDevice = (p: P) => (
  <Svg {...p}>
    <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
    <path d="M8.5 20.5h7" />
  </Svg>
);

export const IconPen = (p: P) => (
  <Svg {...p}>
    <path d="M4 20h4l10-10a2.5 2.5 0 0 0-4-4L4 16z" />
    <path d="M13.5 6.5 17.5 10.5" />
  </Svg>
);

export const IconRecord = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconBug = (p: P) => (
  <Svg {...p}>
    <rect x="7.5" y="7" width="9" height="13" rx="4.5" />
    <path d="M9 5.5 10.5 7M15 5.5 13.5 7M3.5 11h4M16.5 11h4M4 19l3.5-2M20 19l-3.5-2" />
  </Svg>
);

export const IconSparkle = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5l1.7 4.3L18 9.5l-4.3 1.7L12 15.5l-1.7-4.3L6 9.5l4.3-1.7z" />
    <path d="M18 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" />
  </Svg>
);

export const IconBranch = (p: P) => (
  <Svg {...p}>
    <circle cx="7" cy="5.5" r="2.5" />
    <circle cx="7" cy="18.5" r="2.5" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M7 8v8M9.4 8.6 14.6 7.4" />
    <path d="M17 11.5c0 3.5-3 4.5-6.5 5" />
  </Svg>
);

export const IconRocket = (p: P) => (
  <Svg {...p}>
    <path d="M13.5 4.5c4 0 6 2 6 6-1.5 4-5 6-8 7l-4-4 1-4c1-3 2.5-5 5-6z" />
    <circle cx="15.5" cy="8.5" r="1.6" />
    <path d="M7 16c-1.5.5-2.5 2-3 4.5 2.5-.5 4-1.5 4.5-3" />
  </Svg>
);

export const IconLayers = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5 20.5 8 12 12.5 3.5 8z" />
    <path d="m4 12.5 8 4 8-4" />
    <path d="m4 16.5 8 4 8-4" />
  </Svg>
);

export const IconCamera = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 8.5h3l1.5-2.5h8L17.5 8.5h3v11h-17z" />
    <circle cx="12" cy="14" r="3.5" />
  </Svg>
);

export const IconLock = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </Svg>
);

export const IconGoogle = ({ size = 17 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.3h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8.1z"
    />
    <path
      fill="#34A853"
      d="M12 23c3 0 5.5-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.8 0-5.2-1.9-6.1-4.5H2.3v2.8A11 11 0 0 0 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.9 14.2a6.6 6.6 0 0 1 0-4.4V7H2.3a11 11 0 0 0 0 10z"
    />
    <path
      fill="#EA4335"
      d="M12 5.4c1.6 0 3 .6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.3 7l3.6 2.8C6.8 7.2 9.2 5.4 12 5.4z"
    />
  </svg>
);
