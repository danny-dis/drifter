/**
 * Cloud Character SVG
 */

export function CloudCharacter({ idleState }: { idleState: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Cloud body */}
      <path
        d="M18 48C12.477 48 8 43.523 8 38C8 33.115 11.485 29.047 16.076 28.18C17.207 20.655 23.667 15 31.5 15C38.68 15 44.676 20.046 46.126 26.77C47.176 26.27 48.356 26 49.6 26C54.24 26 58 29.76 58 34.4C58 34.8 57.97 35.19 57.92 35.57C62.13 36.28 65.4 39.95 65.4 44.4C65.4 49.15 61.55 53 56.8 53H18Z"
        fill="#e8e8f0"
        stroke="#c0c0d0"
        strokeWidth="1.5"
      />
      {/* Eyes */}
      <ellipse cx="30" cy="36" rx="3" ry={idleState === 'blinking' ? 1 : 3.5} fill="#1a1a2e" />
      <ellipse cx="42" cy="36" rx="3" ry={idleState === 'blinking' ? 1 : 3.5} fill="#1a1a2e" />
      {/* Mouth */}
      <path d="M33 42Q36 45 39 42" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
