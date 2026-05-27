/**
 * Fox Character SVG
 */

export function FoxCharacter({ idleState }: { idleState: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Ears */}
      <path d="M20 20L14 6L28 16" fill="#e8a050" stroke="#c88030" strokeWidth="1" />
      <path d="M52 20L58 6L44 16" fill="#e8a050" stroke="#c88030" strokeWidth="1" />
      {/* Head */}
      <ellipse cx="36" cy="30" rx="18" ry="16" fill="#e8a050" stroke="#c88030" strokeWidth="1.5" />
      {/* Face white area */}
      <ellipse cx="36" cy="36" rx="12" ry="10" fill="#f8f0e0" />
      {/* Eyes */}
      <ellipse cx="28" cy="28" rx="3" ry={idleState === 'blinking' ? 1 : 3.5} fill="#1a1a2e" />
      <ellipse cx="44" cy="28" rx="3" ry={idleState === 'blinking' ? 1 : 3.5} fill="#1a1a2e" />
      {/* Nose */}
      <ellipse cx="36" cy="36" rx="2.5" ry="2" fill="#1a1a2e" />
      {/* Mouth */}
      <path d="M33 39Q36 42 39 39" stroke="#1a1a2e" strokeWidth="1" strokeLinecap="round" fill="none" />
      {/* Body */}
      <ellipse cx="36" cy="54" rx="14" ry="12" fill="#e8a050" stroke="#c88030" strokeWidth="1.5" />
      {/* Tail */}
      <path d="M50 58Q64 52 60 44Q56 40 50 48" fill="#e8a050" stroke="#c88030" strokeWidth="1" />
      <path d="M58 46Q62 44 60 40Q58 38 56 42" fill="#f8f0e0" />
    </svg>
  );
}
