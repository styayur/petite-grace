import type { JSX } from "preact";

type IconProps = JSX.SVGAttributes<SVGSVGElement> & { title?: string };

function Icon({
  title,
  children,
  ...props
}: IconProps & { children: JSX.Element | JSX.Element[] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export const ChevronRight = () => (
  <Icon>
    <path d="m9 18 6-6-6-6" />
  </Icon>
);
export const ChevronDown = () => (
  <Icon>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);
export const SearchIcon = () => (
  <Icon>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-4-4" />
  </Icon>
);
export const DownloadIcon = () => (
  <Icon>
    <path d="M12 3v12" />
    <path d="m7 10 5 5 5-5" />
    <path d="M5 21h14" />
  </Icon>
);
export const PanelLeftIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Icon>
);
export const PanelRightIcon = () => (
  <Icon>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M15 4v16" />
  </Icon>
);
export const MoonIcon = () => (
  <Icon>
    <path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z" />
  </Icon>
);
export const SunIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
  </Icon>
);
export const CloseIcon = () => (
  <Icon>
    <path d="m6 6 12 12M18 6 6 18" />
  </Icon>
);
export const ExpandIcon = () => (
  <Icon>
    <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M21 16v5h-5" />
  </Icon>
);
export const MinimizeIcon = () => (
  <Icon>
    <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M21 16v-5h-5" />
  </Icon>
);
export const FileIcon = () => (
  <Icon>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
    <path d="M14 2v6h6" />
  </Icon>
);
export const CheckIcon = () => (
  <Icon>
    <path d="m5 12 4 4L19 6" />
  </Icon>
);

export const SettingsIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.13.38.34.72.6 1 .3.3.68.44 1.1.4H21v4h-.09A1.7 1.7 0 0 0 19.4 15Z" />
  </Icon>
);

export const ReviewIcon = () => (
  <Icon>
    <rect x="4" y="3" width="16" height="6" rx="1.5" />
    <rect x="4" y="10" width="16" height="6" rx="1.5" />
    <rect x="4" y="17" width="16" height="4" rx="1.5" />
  </Icon>
);
