/**
 * Memory Graph Page
 *
 * Drifter's living knowledge wiki — interactive graph of wiki entries.
 */

import { useEffect, useState } from 'react';
import ReactFlow, { Node, Edge, Controls, Background } from 'react-flow-renderer';
import { platform } from '../platform';

interface WikiEntry {
  id: string;
  title: string;
  summary: string;
  last_updated: string;
  user_sentiment: string;
  facts: string[];
  open_questions: string[];
}

export function MemoryPage() {
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<WikiEntry | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadEntries();
  }, []);

  async function loadEntries() {
    try {
      const data = await platform.network.api.get('/api/wiki') as WikiEntry[];
      setEntries(data);

      const flowNodes: Node[] = data.map((entry, index) => ({
        id: entry.id,
        type: 'default',
        data: { label: entry.title },
        position: {
          x: 100 + (index % 5) * 220,
          y: 100 + Math.floor(index / 5) * 120,
        },
        style: {
          background: 'var(--color-bg-card)',
          color: 'var(--color-text-primary)',
          borderRadius: '8px',
          padding: '8px 16px',
          border: '1px solid var(--color-border)',
        },
      }));

      setNodes(flowNodes);
      setEdges([]); // Edges from wiki_relationships
    } catch {
      // Backend not ready
    }
  }

  async function handleSummaryRequest() {
    try {
      const data = await platform.network.api.get('/api/wiki/summary') as { summary: string };
      alert(data.summary); // TODO: Replace with proper modal
    } catch {
      // Backend not ready
    }
  }

  return (
    <div className="h-full flex">
      {/* Graph */}
      <div className="flex-1">
        {/* Search Bar */}
        <div className="absolute top-lg left-lg right-lg z-sticky">
          <div className="max-w-md mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search memory..."
              className="w-full bg-bg-overlay border border-border rounded-lg px-md py-sm text-text-primary text-sm outline-none focus:border-accent-blue transition-colors"
            />
          </div>
        </div>

        {/* Summary Button */}
        <button
          onClick={handleSummaryRequest}
          className="absolute top-lg right-lg z-sticky px-md py-sm bg-accent-purple text-text-inverse rounded-lg text-sm hover:bg-accent-purple-soft transition-colors"
        >
          What do you know about me?
        </button>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => {
            const entry = entries.find((e) => e.id === node.id);
            if (entry) setSelectedEntry(entry);
          }}
          fitView
        >
          <Background color="#2a2a4a" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Side Panel */}
      {selectedEntry && (
        <div className="w-80 bg-bg-secondary border-l border-border p-lg overflow-y-auto">
          <h2 className="text-lg font-semibold text-text-primary mb-md">
            {selectedEntry.title}
          </h2>
          <p className="text-text-secondary text-sm mb-md">
            {selectedEntry.summary}
          </p>

          {/* Facts */}
          {selectedEntry.facts?.length > 0 && (
            <div className="mb-md">
              <h3 className="text-sm font-semibold text-text-secondary mb-xs">Facts</h3>
              <ul className="space-y-xs">
                {selectedEntry.facts.map((fact, i) => (
                  <li key={i} className="text-text-primary text-sm flex items-start gap-xs">
                    <span className="text-accent-blue mt-1">•</span>
                    {fact}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Open Questions */}
          {selectedEntry.open_questions?.length > 0 && (
            <div className="mb-md">
              <h3 className="text-sm font-semibold text-text-secondary mb-xs">Open Questions</h3>
              <ul className="space-y-xs">
                {selectedEntry.open_questions.map((q, i) => (
                  <li key={i} className="text-text-muted text-sm flex items-start gap-xs">
                    <span className="text-accent-amber mt-1">?</span>
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-text-muted text-xs">
            Last updated: {new Date(selectedEntry.last_updated).toLocaleString()}
          </p>

          {/* Edit button */}
          <button className="w-full mt-md py-sm bg-bg-card text-text-secondary rounded-lg text-sm hover:bg-bg-hover transition-colors">
            Edit Entry
          </button>
        </div>
      )}
    </div>
  );
}
