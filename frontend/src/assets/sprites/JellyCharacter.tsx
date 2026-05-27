/**
 * Jelly Character SVG
 */

export function JellyCharacter({ idleState }: { idleState: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Bell */}
      <path
        d="M20 30C20 18 28 10 36 10C44 10 52 18 52 30C52 38 48 42 44 42H28C24 42 20 38 20 30Z"
        fill="#d0b8f0"
        stroke="#b098d8"
        strokeWidth="1.5"
        opacity="0.9"
      />
      {/* Inner glow */}
      <ellipse cx="36" cy="24" rx="8" ry="6" fill="#e8d8f8" opacity="0.5" />
      {/* Eyes */}
      <ellipse cx="30" cy="26" rx="3" ry={idleState === 'blinking' ? 1 : 3.5} fill="#1a1a2e" />
      <ellipse cx="42" cy="26" rx="3" ry={idleState === 'blinking' ? 1 : 3.5} fill="#1a1a2e" />
      {/* Mouth */}
      <path d="M33 32Q36 35 39 32" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      {/* Tentacles */}
      <path d="M26 42Q24 50 26 56" stroke="#b098d8" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 42Q30 52 32 58" stroke="#b098d8" strokeWidth="2" strokeLinecap="round" />
      <path d="M38 42Q40 52 38 58" stroke="#b098d8" strokeWidth="2" strokeLinecap="round" />
      <path d="M44 42Q46 50 44 56" stroke="#b098d8" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
