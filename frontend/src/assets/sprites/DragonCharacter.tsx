/**
 * Dragon Character SVG
 */

export function DragonCharacter({ idleState }: { idleState: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <ellipse cx="36" cy="42" rx="18" ry="20" fill="#a8d8a8" stroke="#7ab87a" strokeWidth="1.5" />
      {/* Head */}
      <ellipse cx="36" cy="26" rx="14" ry="12" fill="#a8d8a8" stroke="#7ab87a" strokeWidth="1.5" />
      {/* Horns */}
      <path d="M24 16L20 8L28 14" fill="#d4a017" />
      <path d="M48 16L52 8L44 14" fill="#d4a017" />
      {/* Eyes */}
      <ellipse cx="30" cy="24" rx="3" ry={idleState === 'blinking' ? 1 : 3.5} fill="#1a1a2e" />
      <ellipse cx="42" cy="24" rx="3" ry={idleState === 'blinking' ? 1 : 3.5} fill="#1a1a2e" />
      {/* Mouth */}
      <path d="M32 32Q36 35 40 32" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Wings */}
      <path d="M18 36L8 28L14 40Z" fill="#88c888" stroke="#7ab87a" strokeWidth="1" />
      <path d="M54 36L64 28L58 40Z" fill="#88c888" stroke="#7ab87a" strokeWidth="1" />
      {/* Belly */}
      <ellipse cx="36" cy="46" rx="10" ry="12" fill="#c8e8c8" />
    </svg>
  );
}
