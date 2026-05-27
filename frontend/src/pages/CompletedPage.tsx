/**
 * Completed Projects Page
 *
 * Card layout for finished work with filters.
 */

import { useEffect, useState } from 'react';
import { platform } from '../platform';

interface CompletedProject {
  id: string;
  title: string;
  completed_at: string;
  description: string;
  source: string;
}

export function CompletedPage() {
  const [projects, setProjects] = useState<CompletedProject[]>([]);
  const [originFilter, setOriginFilter] = useState<string>('all');

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await platform.network.api.get('/api/projects/completed') as CompletedProject[];
      setProjects(data);
    } catch {
      // Backend not ready
    }
  }

  const filtered = originFilter === 'all'
    ? projects
    : projects.filter((p) => p.source === originFilter);

  return (
    <div className="h-full overflow-y-auto p-lg">
      {/* Filter Bar */}
      <div className="max-w-4xl mx-auto mb-lg">
        <div className="flex gap-sm">
          {['all', 'user', 'agent'].map((origin) => (
            <button
              key={origin}
              onClick={() => setOriginFilter(origin)}
              className={`
                px-md py-sm rounded-lg text-sm transition-colors
                ${originFilter === origin
                  ? 'bg-accent-blue text-text-inverse'
                  : 'bg-bg-card text-text-secondary hover:bg-bg-hover'
                }
              `}
            >
              {origin === 'all' ? 'All' : origin === 'user' ? 'User-created' : 'Agent-discovered'}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-md">
        {filtered.map((project) => (
          <div
            key={project.id}
            className="bg-bg-card border border-border rounded-lg p-md hover:border-border-light transition-colors cursor-pointer"
          >
            <h3 className="text-text-primary text-base font-medium mb-xs">
              {project.title}
            </h3>
            <p className="text-text-muted text-xs mb-sm">
              Completed {new Date(project.completed_at).toLocaleDateString()}
            </p>
            <p className="text-text-secondary text-sm line-clamp-2">
              {project.description?.slice(0, 100) || 'No summary available.'}
            </p>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full text-center py-xl text-text-muted">
            <p className="text-lg mb-sm">No completed projects yet</p>
            <p className="text-sm">Finished work will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
