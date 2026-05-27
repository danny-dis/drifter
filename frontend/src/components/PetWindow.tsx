/**
 * Pet Window Component
 *
 * Renders the floating pet character with idle animations and notification states.
 * Used in the dedicated pet Electron window.
 *
 * The pet has 3 idle states that cycle randomly:
 * - Breathing (slow scale pulse)
 * - Blinking
 * - Wiggle (character-dependent)
 *
 * And 4 notification states:
 * - thinking: slow spinning halo
 * - has_news: bouncing with glowing dot
 * - timer_done: flashing with clock icon
 * - idea_connected: sparkle burst
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { platform } from '../platform';

type AnimationState =
  | 'idle'
  | 'thinking'
  | 'has_news'
  | 'timer_done'
  | 'idea_connected';

type IdleState = 'breathing' | 'blinking' | 'wiggle';

// Character SVG components — each character has its own SVG rendering
import { GhostCharacter } from '../assets/sprites/GhostCharacter';
import { RobotCharacter } from '../assets/sprites/RobotCharacter';
import { CloudCharacter } from '../assets/sprites/CloudCharacter';
import { DragonCharacter } from '../assets/sprites/DragonCharacter';
import { FoxCharacter } from '../assets/sprites/FoxCharacter';
import { JellyCharacter } from '../assets/sprites/JellyCharacter';

const CHARACTER_MAP: Record<string, React.FC<{ idleState: IdleState }>> = {
  ghost: GhostCharacter,
  robot: RobotCharacter,
  cloud: CloudCharacter,
  dragon: DragonCharacter,
  fox: FoxCharacter,
  jelly: JellyCharacter,
};

export function PetWindow() {
  const [animationState, setAnimationState] = useState<AnimationState>('idle');
  const [idleState, setIdleState] = useState<IdleState>('breathing');
  const [character, setCharacter] = useState<string>('ghost');

  useEffect(() => {
    loadCompanionConfig();
    setupIdleCycle();
    setupNotificationListener();
  }, []);

  async function loadCompanionConfig() {
    try {
      const config = await platform.storage.getAll();
      if (config.companion) {
        const companion = typeof config.companion === 'string'
          ? JSON.parse(config.companion)
          : config.companion;
        setCharacter(companion.character || 'ghost');
      }
    } catch {
      // Use defaults
    }
  }

  function setupIdleCycle() {
    const idleStates: IdleState[] = ['breathing', 'blinking', 'wiggle'];
    let index = 0;

    const interval = setInterval(() => {
      if (animationState === 'idle') {
        index = (index + 1) % idleStates.length;
        setIdleState(idleStates[index]);
      }
    }, 4000);

    return () => clearInterval(interval);
  }

  function setupNotificationListener() {
    // Listen for animation state changes from Electron main process
    if (platform.isElectron && window.electronAPI) {
      window.electronAPI.on('pet:animation-state', (state: AnimationState) => {
        setAnimationState(state);

        // Auto-reset after animation completes
        if (state !== 'idle') {
          setTimeout(() => setAnimationState('idle'), 3000);
        }
      });
    }
  }

  function handleClick() {
    // Single click → open Quick Capture
    platform.pet?.openCapture();
  }

  function handleDoubleClick() {
    // Double click → open main window
    platform.pet?.openMain();
  }

  const CharacterComponent = CHARACTER_MAP[character] || GhostCharacter;

  return (
    <div
      className="w-full h-full flex items-center justify-center cursor-pointer select-none"
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <div className="relative">
        {/* Notification indicators */}
        <AnimatePresence>
          {animationState === 'thinking' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, rotate: 360 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-2 -right-2 w-4 h-4 border-2 border-accent-blue rounded-full border-t-transparent"
            />
          )}

          {animationState === 'has_news' && (
            <motion.div
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: -4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 w-2 h-2 bg-accent-green rounded-full"
            />
          )}

          {animationState === 'timer_done' && (
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: [1, 0.3, 1] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, repeat: Infinity }}
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs"
            >
              ⏰
            </motion.div>
          )}

          {animationState === 'idea_connected' && (
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1.5, opacity: 0 }}
              exit={{ opacity: 0 }}
              className="absolute -top-4 left-1/2 -translate-x-1/2 text-accent-amber"
            >
              ✦
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pet character */}
        <motion.div
          animate={
            animationState === 'idle'
              ? idleState === 'breathing'
                ? { scale: [1, 1.05, 1] }
                : idleState === 'blinking'
                  ? { opacity: [1, 1, 0.3, 1, 1] }
                  : { rotate: [0, -5, 0, 5, 0] }
              : animationState === 'has_news'
                ? { y: [0, -8, 0] }
                : {}
          }
          transition={
            animationState === 'idle'
              ? {
                  duration: idleState === 'breathing' ? 3 : idleState === 'blinking' ? 4 : 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : { duration: 0.5, repeat: Infinity, repeatType: 'reverse' }
          }
          className="w-[72px] h-[72px]"
        >
          <CharacterComponent idleState={idleState} />
        </motion.div>
      </div>
    </div>
  );
}
