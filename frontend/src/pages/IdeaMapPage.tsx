/**
 * Idea Map Page
 *
 * Visual node graph of Concept Map Nodes and connected source ideas.
 * Uses react-flow for the graph layout.
 */

import { useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
} from 'react-flow-renderer';
import { platform } from '../platform';

const STATUS_COLORS: Record<string, string> = {
  thinking: '#4a90d9',
  researching: '#d4a017',
  ready: '#5cb85c',
  project: '#9b59b6',
};

export function IdeaMapPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  useEffect(() => {
    loadConcepts();
  }, []);

  async function loadConcepts() {
    try {
      const concepts = await platform.network.api.get('/api/concepts') as any[];

      const flowNodes: Node[] = concepts.map((concept, index) => ({
        id: concept.id,
        type: 'default',
        data: {
          label: concept.name,
          score: concept.tangibility_score,
          status: concept.status,
          ideaCount: concept.idea_count,
        },
        position: {
          x: 100 + (index % 4) * 250,
          y: 100 + Math.floor(index / 4) * 150,
        },
        style: {
          background: STATUS_COLORS[concept.status] || '#4a90d9',
          color: '#fff',
          borderRadius: '8px',
          padding: '8px 16px',
          minWidth: '120px',
          width: `${Math.max(120, concept.tangibility_score * 200)}px`,
        },
      }));

      setNodes(flowNodes);
      setEdges([]); // Edges would be computed from concept relationships
    } catch {
      // Backend not ready
    }
  }

  return (
    <div className="h-full flex">
      {/* Graph */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={(_, node) => setSelectedNode(node)}
          fitView
        >
          <Background color="#2a2a4a" gap={20} />
          <Controls />
        </ReactFlow>
      </div>

      {/* Side Panel */}
      {selectedNode && (
        <div className="w-80 bg-bg-secondary border-l border-border p-lg overflow-y-auto">
          <h2 className="text-lg font-semibold text-text-primary mb-md">
            {selectedNode.data.label}
          </h2>
          <p className="text-text-secondary text-sm mb-sm">
            Tangibility: {(selectedNode.data.score * 100).toFixed(0)}%
          </p>
          <p className="text-text-muted text-xs mb-md">
            {selectedNode.data.ideaCount} linked ideas
          </p>

          <div className="flex flex-col gap-sm">
            <button className="w-full py-sm bg-accent-blue text-text-inverse rounded-lg text-sm font-medium hover:bg-accent-blue-soft transition-colors">
              Start Project
            </button>
            <button className="w-full py-sm bg-bg-card text-text-secondary rounded-lg text-sm hover:bg-bg-hover transition-colors">
              Research More
            </button>
            <button className="w-full py-sm bg-bg-card text-text-muted rounded-lg text-sm hover:bg-bg-hover transition-colors">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-lg left-lg bg-bg-overlay rounded-lg p-sm text-xs text-text-secondary border border-border">
        <div className="flex flex-col gap-xs">
          <div className="flex items-center gap-xs">
            <span className="w-3 h-3 rounded-full bg-status-thinking" />
            <span>Thinking</span>
          </div>
          <div className="flex items-center gap-xs">
            <span className="w-3 h-3 rounded-full bg-status-mapped" />
            <span>Researching</span>
          </div>
          <div className="flex items-center gap-xs">
            <span className="w-3 h-3 rounded-full bg-status-ready" />
            <span>Ready</span>
          </div>
          <div className="flex items-center gap-xs">
            <span className="w-3 h-3 rounded-full bg-status-project" />
            <span>Project</span>
          </div>
        </div>
      </div>
    </div>
  );
}
