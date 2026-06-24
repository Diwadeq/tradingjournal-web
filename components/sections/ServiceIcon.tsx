type IconName = "calculator" | "lightbulb" | "wrench" | "banknote";

const PATHS: Record<IconName, string> = {
  calculator:
    "M4 2h16a1 1 0 011 1v18a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1zM8 6h8M8 10h2M8 14h2M8 18h2M14 10h2M14 14h2M14 18h2",
  lightbulb:
    "M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z",
  wrench:
    "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  banknote:
    "M2 6h20v12H2zM12 12a3 3 0 100-6 3 3 0 000 6zM2 10h2M20 10h2M2 14h2M20 14h2",
};

export function ServiceIcon({ name }: { name: string }) {
  const path = PATHS[name as IconName] ?? PATHS["calculator"];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
