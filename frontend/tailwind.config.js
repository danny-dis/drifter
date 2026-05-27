/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          card: 'var(--color-bg-card)',
          hover: 'var(--color-bg-hover)',
          overlay: 'var(--color-bg-overlay)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          inverse: 'var(--color-text-inverse)',
        },
        accent: {
          blue: 'var(--color-accent-blue)',
          'blue-soft': 'var(--color-accent-blue-soft)',
          green: 'var(--color-accent-green)',
          'green-soft': 'var(--color-accent-green-soft)',
          amber: 'var(--color-accent-amber)',
          'amber-soft': 'var(--color-accent-amber-soft)',
          purple: 'var(--color-accent-purple)',
          'purple-soft': 'var(--color-accent-purple-soft)',
          red: 'var(--color-accent-red)',
          'red-soft': 'var(--color-accent-red-soft)',
        },
        status: {
          raw: 'var(--color-status-raw)',
          thinking: 'var(--color-status-thinking)',
          mapped: 'var(--color-status-mapped)',
          ready: 'var(--color-status-ready)',
          project: 'var(--color-status-project)',
          dismissed: 'var(--color-status-dismissed)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          light: 'var(--color-border-light)',
        },
      },
      fontFamily: {
        sans: ['var(--font-family)'],
      },
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
      },
      lineHeight: {
        tight: 'var(--line-height-tight)',
        base: 'var(--line-height-base)',
        relaxed: 'var(--line-height-relaxed)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      zIndex: {
        base: 'var(--z-base)',
        dropdown: 'var(--z-dropdown)',
        sticky: 'var(--z-sticky)',
        overlay: 'var(--z-overlay)',
        modal: 'var(--z-modal)',
        toast: 'var(--z-toast)',
        pet: 'var(--z-pet)',
      },
      animation: {
        'pet-breathe': 'breathe 3s ease-in-out infinite',
        'pet-blink': 'blink 4s ease-in-out infinite',
        'pet-wiggle': 'wiggle 2s ease-in-out infinite',
        'pet-bounce': 'bounce 0.5s ease-in-out',
        'pet-spin': 'spin 2s linear infinite',
        'pet-flash': 'flash 0.3s ease-in-out infinite',
        'pet-sparkle': 'sparkle 1s ease-in-out',
      },
      keyframes: {
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
        },
        blink: {
          '0%, 90%, 100%': { opacity: '1' },
          '95%': { opacity: '0.3' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(0deg)' },
          '25%': { transform: 'rotate(-5deg)' },
          '75%': { transform: 'rotate(5deg)' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        flash: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
        sparkle: {
          '0%': { transform: 'scale(0) rotate(0deg)', opacity: '1' },
          '50%': { transform: 'scale(1.2) rotate(180deg)', opacity: '0.8' },
          '100%': { transform: 'scale(0) rotate(360deg)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
};
