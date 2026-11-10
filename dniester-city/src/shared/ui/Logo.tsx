export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Dniester City">
      <rect width="48" height="48" rx="14" fill="#1F5FD6" />
      <path
        d="M10 33c4-5 7 5 11 0s7 5 11 0 5-3 6-2"
        fill="none"
        stroke="#bcd4ff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M13 26V17l8-6 8 6v9"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx="35" cy="14" r="4" fill="#ffffff" />
    </svg>
  );
}
