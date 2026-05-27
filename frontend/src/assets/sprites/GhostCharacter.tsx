/**
 * Ghost Character SVG
 *
 * Animated SVG sprite with idle states: breathing, blinking, wiggle.
 */

export function GhostCharacter({ idleState }: { idleState: string }) {
  return (
    <svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Body */}
      <path
        d="M16 56V28C16 19.163 23.163 12 32 12H40C48.837 12 56 19.163 56 28V56L48 50L40 56L32 50L24 56L16 50Z"
        fill="#e8e8f0"
        stroke="#c0c0d0"
        strokeWidth="1.5"
      />
      {/* Eyes */}
      <ellipse cx="28" cy="32" rx="4" ry={idleState === 'blinking' ? 1 : 5} fill="#1a1a2e" />
      <ellipse cx="44" cy="32" rx="4" ry={idleState === 'blinking' ? 1 : 5} fill="#1a1a2e" />
      {/* Mouth */}
      <ellipse cx="36" cy="42" rx="3" ry="2" fill="#1a1a2e" />
      {/* Cheek blush */}
      <circle cx="22" cy="38" r="3" fill="#ffb3b3" opacity="0.4" />
      <circle cx="50" cy="38" r="3" fill="#ffb3b3" opacity="0.4" />
    </svg>
  );
}
