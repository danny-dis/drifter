/**
 * Onboarding Flow
 *
 * Single-screen onboarding that runs on first launch.
 * Captures companion name and character selection.
 * No multi-page wizard — everything on one screen.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { platform } from '../platform';

interface OnboardingProps {
  onComplete: () => void;
}

interface CharacterOption {
  id: string;
  name: string;
  preview: string; // Emoji preview for now; replaced by SVG in production
}

const CHARACTERS: CharacterOption[] = [
  { id: 'ghost', name: 'Ghost', preview: '👻' },
  { id: 'robot', name: 'Robot', preview: '🤖' },
  { id: 'cloud', name: 'Cloud', preview: '☁️' },
  { id: 'dragon', name: 'Dragon', preview: '🐉' },
  { id: 'fox', name: 'Fox', preview: '🦊' },
  { id: 'jelly', name: 'Jelly', preview: '🪼' },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [name, setName] = useState('');
  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && selectedCharacter !== null;

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const companionConfig = {
        name: name.trim(),
        character: selectedCharacter,
        createdAt: new Date().toISOString(),
      };

      const config = await platform.storage.getAll();
      config.onboardingComplete = true;
      config.companion = companionConfig;

      await platform.storage.set('onboardingComplete', 'true');
      await platform.storage.set('companion', JSON.stringify(companionConfig));

      onComplete();
    } catch (err) {
      console.error('Failed to save onboarding config:', err);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-lg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md w-full"
      >
        {/* Title */}
        <h1 className="text-2xl font-semibold text-text-primary text-center mb-lg">
          Meet your companion
        </h1>

        {/* Name Input */}
        <div className="mb-xl">
          <label
            htmlFor="companion-name"
            className="block text-sm text-text-secondary mb-sm"
          >
            What do you want to call your companion?
          </label>
          <input
            id="companion-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canSubmit) handleSubmit();
            }}
            className="w-full bg-bg-card border border-border rounded-lg px-md py-sm text-text-primary text-base outline-none focus:border-accent-blue transition-colors"
            autoFocus
          />
        </div>

        {/* Character Picker */}
        <div className="mb-xl">
          <label className="block text-sm text-text-secondary mb-sm">
            Pick a character
          </label>
          <div className="grid grid-cols-3 gap-sm">
            {CHARACTERS.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedCharacter(char.id)}
                className={`
                  flex flex-col items-center gap-xs p-md rounded-lg border transition-all duration-200
                  ${selectedCharacter === char.id
                    ? 'border-accent-blue bg-bg-hover'
                    : 'border-border bg-bg-card hover:border-border-light'
                  }
                `}
              >
                <span className="text-3xl">{char.preview}</span>
                <span className="text-xs text-text-secondary">{char.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className={`
            w-full py-sm rounded-lg text-base font-medium transition-all duration-200
            ${canSubmit
              ? 'bg-accent-blue text-text-inverse hover:bg-accent-blue-soft'
              : 'bg-bg-card text-text-muted cursor-not-allowed'
            }
          `}
        >
          {isSubmitting ? 'Setting up...' : 'Let\'s go'}
        </button>
      </motion.div>
    </div>
  );
}
