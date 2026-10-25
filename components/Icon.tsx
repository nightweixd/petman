import type { CSSProperties } from "react";
const paths = {
  grid: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  users:
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M16 3a4 4 0 0 1 0 8 M22 21v-2a4 4 0 0 0-3-3.87 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  calendar:
    "M8 2v4 M16 2v4 M3 10h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2 M8 14h2 M14 14h2 M8 18h2",
  paw: "M12 12c-2 0-3 3-5 4-3 2-1 5 1 4 3-1 5-1 8 0 2 1 4-2 1-4-2-1-3-4-5-4 M6 5a2 3 0 1 0 0 6 2 3 0 0 0 0-6 M18 5a2 3 0 1 0 0 6 2 3 0 0 0 0-6 M10 2a1.5 2.5 0 1 0 0 5 1.5 2.5 0 0 0 0-5 M14 2a1.5 2.5 0 1 0 0 5 1.5 2.5 0 0 0 0-5",
  award: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M8 12l-1 9 5-3 5 3-1-9",
  lock: "M6 10h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2 M8 10V6a4 4 0 0 1 8 0v4 M12 14v4",
  archive: "M3 3h18v5H3z M5 8v13h14V8 M10 12h4",
  trash: "M3 6h18 M9 6V3h6v3 M5 6l1 15h12l1-15 M10 10v7 M14 10v7",
  logout: "M9 3H4v18h5 M13 8l5 4-5 4 M8 12h12",
  search: "M21 21l-5-5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  chevron: "M9 5l7 7-7 7",
  down: "M6 9l6 6 6-6",
  plus: "M12 5v14 M5 12h14",
  close: "M6 6l12 12 M6 18 18 6",
  filter: "M4 7h16 M7 12h10 M10 17h4",
  export: "M12 3v12 M8 7l4-4 4 4 M4 14v7h16v-7",
  arrow: "M7 17 17 7 M7 7h10v10",
  wallet:
    "M20 8V5H5a3 3 0 0 1 0-6 M4 3h15v4 M4 7h17v14H4a2 2 0 0 1-2-2V5 M16 12h5v5h-5z",
  clock: "M12 8v5l3 2 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3l-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3z",
  chart: "M3 3v18h18 M7 14l4-5 4 3 6-7",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  check: "M5 12l4 4L19 6",
  mail: "M3 5h18v14H3z M3 5l9 8 9-8",
  help: "M9.5 8a2.5 2.5 0 0 1 5 0c0 2-2.5 2-2.5 4 M12 16v.1 M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
} as const;
export type IconName = keyof typeof paths;
export default function Icon({
  name,
  size = 20,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
