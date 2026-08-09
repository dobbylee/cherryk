import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

const commonProps = {
  "aria-hidden": true,
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 1.8,
  viewBox: "0 0 24 24",
};

export function ArrowLeftIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M14.5 5 13 3h-2L9.5 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <rect height="13" rx="2" width="13" x="8" y="8" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

export function GoogleIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.38a4.6 4.6 0 0 1-2 3.02v2.53h3.24c1.9-1.75 2.98-4.33 2.98-7.39Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.97-.9 6.62-2.38l-3.24-2.53c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.13H3.05v2.61A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.12-1.32.32-1.92V7.47H3.05A10 10 0 0 0 2 12c0 1.61.39 3.14 1.05 4.53l3.35-2.61Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.95c1.47 0 2.79.5 3.83 1.5L18.7 4.58A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.95 5.47l3.35 2.61C7.19 7.71 9.4 5.95 12 5.95Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <rect height="17" rx="2" width="18" x="3" y="3.5" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 17 4.5-4.5 3.5 3 2-2 6 5.5" />
    </svg>
  );
}

export function LogoMark({ className, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 40 40"
      {...props}
    >
      <rect fill="#087B93" height="40" rx="13" width="40" />
      <path
        d="M11 13.5c3.9 0 6.9 1 9 3 2.1-2 5.1-3 9-3v14c-3.9 0-6.9 1-9 3-2.1-2-5.1-3-9-3v-14Z"
        stroke="white"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
      <path
        d="m16 21 2.3 2.3L24 17.8"
        stroke="#BDEBF1"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}

export function QuizIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <rect height="18" rx="3" width="16" x="4" y="3" />
      <path d="m8 8 1 1 2-2M13 8h3M8 13l1 1 2-2M13 13h3M8 18l1 1 2-2M13 18h3" />
    </svg>
  );
}

export function RefreshIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M20 6v5h-5" />
      <path d="M18.5 15.5A7 7 0 1 1 19 8l1 3" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="m12 3 1.2 4.1a5 5 0 0 0 3.7 3.7L21 12l-4.1 1.2a5 5 0 0 0-3.7 3.7L12 21l-1.2-4.1a5 5 0 0 0-3.7-3.7L3 12l4.1-1.2a5 5 0 0 0 3.7-3.7L12 3Z" />
    </svg>
  );
}

export function StreakIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M13.5 3.5c.6 3-1.7 4.2-3.2 6.1-1.2 1.5-1.6 3.1-.4 4.8.3-1.8 1.6-2.7 3.1-4 .2 2 2.1 3.1 2.1 5.3 0 1.8-1.3 3.2-3.1 3.2-3.5 0-6-2.5-6-5.9 0-4.2 3.1-7.6 7.5-9.5Z" />
    </svg>
  );
}

export function WriteIcon(props: IconProps) {
  return (
    <svg {...commonProps} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
      <path d="m14 6 4 4" />
    </svg>
  );
}
