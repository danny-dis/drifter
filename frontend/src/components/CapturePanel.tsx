/**
 * Quick Capture Panel
 *
 * Pill-shaped floating input that slides out from the pet.
 * Used in the dedicated capture panel Electron window.
 */

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { platform } from '../platform';

export function CapturePanel() {
  const [input, setInput] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    inputRef.current?.focus();
  }, []);

  async function handleSubmit() {
    if (!input.trim()) return;

    try {
      await platform.network.api.post('/api/ideas', {
        raw: input.trim(),
        source: 'text',
        attachments: [],
      });

      setSubmitted(true);

      // Auto-close after showing confirmation
      setTimeout(() => {
        window.close();
      }, 2000);
    } catch (err) {
      console.error('Failed to capture idea:', err);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      window.close();
    }
  }

  if (submitted) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-bg-overlay rounded-full">
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-text-secondary text-sm"
        >
          Got it. I&apos;m thinking.
        </motion.p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center bg-bg-card rounded-full shadow-lg border border-border px-sm">
      <input
        ref={inputRef}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What&apos;s in your head right now?"
        className="flex-1 bg-transparent text-text-primary text-sm outline-none placeholder:text-text-muted px-xs"
      />

      {/* Voice input button */}
      <button
        className="p-xs text-text-secondary hover:text-text-primary transition-colors"
        title="Voice input"
        onClick={() => {
          // TODO: Implement voice input via Web Speech API
          console.log('Voice input not yet implemented');
        }}
      >
        🎤
      </button>

      {/* File attachment button */}
      <button
        className="p-xs text-text-secondary hover:text-text-primary transition-colors"
        title="Attach file"
        onClick={() => {
          // TODO: Implement file picker
          console.log('File attachment not yet implemented');
        }}
      >
        📎
      </button>

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!input.trim()}
        className={`
          p-xs ml-xs rounded-full transition-colors
          ${input.trim()
            ? 'text-accent-blue hover:text-accent-blue-soft'
            : 'text-text-muted'
          }
        `}
        title="Send"
      >
        →
      </button>
    </div>
  );
}
