/**
 * Capture Page (Home)
 *
 * Landing page with large centered input and scrolling feed of recent ideas.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { platform } from '../platform';

interface Idea {
  id: string;
  raw: string;
  timestamp: string;
  source: string;
  tags: string[];
  status: string;
  research_notes: string;
}

const STATUS_COLORS: Record<string, string> = {
  raw: 'bg-status-raw',
  processing: 'bg-status-thinking',
  mapped: 'bg-status-mapped',
  project: 'bg-status-project',
  archived: 'bg-status-dismissed',
};

export function CapturePage() {
  const [input, setInput] = useState('');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadIdeas();
    const ws = platform.network.connectWebSocket((data: any) => {
      if (data.type === 'idea_captured') {
        loadIdeas();
      }
    });
    return () => ws.close();
  }, []);

  async function loadIdeas() {
    try {
      const data = await platform.network.api.get('/api/ideas?limit=50') as Idea[];
      setIdeas(data);
    } catch {
      // Backend not ready yet
    }
  }

  async function handleSubmit() {
    if (!input.trim()) return;

    try {
      await platform.network.api.post('/api/ideas', {
        raw: input.trim(),
        source: 'text',
        attachments: [],
      });
      setInput('');
      loadIdeas();
    } catch (err) {
      console.error('Failed to capture idea:', err);
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Input Area */}
      <div className="p-lg pb-md">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-sm">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmit();
              }}
              placeholder="What's in your head right now?"
              className="flex-1 bg-bg-card border border-border rounded-lg px-md py-sm text-text-primary text-base outline-none focus:border-accent-blue transition-colors"
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className={`
                px-lg py-sm rounded-lg text-base font-medium transition-all
                ${input.trim()
                  ? 'bg-accent-blue text-text-inverse hover:bg-accent-blue-soft'
                  : 'bg-bg-card text-text-muted cursor-not-allowed'
                }
              `}
            >
              Capture
            </button>
          </div>
        </div>
      </div>

      {/* Ideas Feed */}
      <div className="flex-1 overflow-y-auto px-lg pb-md">
        <div className="max-w-2xl mx-auto space-y-sm">
          {ideas.map((idea) => (
            <motion.div
              key={idea.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`
                bg-bg-card border border-border rounded-lg p-md cursor-pointer
                hover:border-border-light transition-colors
                ${expandedId === idea.id ? 'border-accent-blue' : ''}
              `}
              onClick={() => setExpandedId(expandedId === idea.id ? null : idea.id)}
            >
              <div className="flex items-start justify-between gap-sm">
                <p className="text-text-primary text-base flex-1">{idea.raw}</p>
                <span className={`
                  px-xs py-xs rounded-full text-xs text-text-inverse
                  ${STATUS_COLORS[idea.status] || 'bg-status-raw'}
                `}>
                  {idea.status}
                </span>
              </div>
              <p className="text-text-muted text-xs mt-xs">
                {new Date(idea.timestamp).toLocaleString()}
              </p>

              {/* Expanded details */}
              {expandedId === idea.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-sm pt-sm border-t border-border"
                >
                  {idea.tags.length > 0 && (
                    <div className="flex flex-wrap gap-xs mb-sm">
                      {idea.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-xs py-xs bg-bg-hover rounded-full text-xs text-text-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {idea.research_notes && (
                    <p className="text-text-secondary text-sm">{idea.research_notes}</p>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}

          {ideas.length === 0 && (
            <div className="text-center py-xl text-text-muted">
              <p className="text-lg mb-sm">No ideas yet</p>
              <p className="text-sm">Capture your first thought above</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
