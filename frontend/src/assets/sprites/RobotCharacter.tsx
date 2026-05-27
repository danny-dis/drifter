/**
 * Robot Character SVG
 */

export function RobotCharacter({ idleState }: { idleState: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Antenna */}
      <line x1="36" y1="8" x2="36" y2="14" stroke="#a0a0b0" strokeWidth="2" />
      <circle cx="36" cy="6" r="3" fill="#4a90d9" />
      {/* Head */}
      <rect x="20" y="14" width="32" height="28" rx="6" fill="#d0d0e0" stroke="#a0a0b0" strokeWidth="1.5" />
      {/* Eyes */}
      <rect x="26" y="22" width="6" height={idleState === 'blinking' ? 2 : 6} rx="1" fill="#1a1a2e" />
      <rect x="40" y="22" width="6" height={idleState === 'blinking' ? 2 : 6} rx="1" fill="#1a1a2e" />
      {/* Mouth */}
      <rect x="30" y="34" width="12" height="3" rx="1.5" fill="#1a1a2e" />
      {/* Body */}
      <rect x="22" y="44" width="28" height="20" rx="4" fill="#c0c0d0" stroke="#a0a0b0" strokeWidth="1.5" />
      {/* Chest light */}
      <circle cx="36" cy="54" r="4" fill="#5cb85c" opacity="0.8" />
    </svg>
  );
}
