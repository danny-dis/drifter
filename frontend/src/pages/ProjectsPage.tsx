/**
 * Active Projects Page
 *
 * Kanban-style board showing all in-progress projects.
 */

import { useEffect, useState } from 'react';
import { platform } from '../platform';

interface Project {
  id: string;
  title: string;
  status: string;
  source: string;
  progress: number;
  description: string;
  updated_at: string;
}

const COLUMNS = [
  { id: 'in_progress', label: 'In Progress' },
  { id: 'waiting_research', label: 'Waiting for Research' },
  { id: 'review_ready', label: 'Review Ready' },
  { id: 'blocked', label: 'Blocked' },
];

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  async function loadProjects() {
    try {
      const data = await platform.network.api.get('/api/projects') as Project[];
      setProjects(data);
    } catch {
      // Backend not ready
    }
  }

  return (
    <div className="h-full overflow-x-auto p-lg">
      <div className="flex gap-lg min-w-max">
        {COLUMNS.map((column) => {
          const columnProjects = projects.filter(
            (p) => p.status.replace('_', '_') === column.id
          );

          return (
            <div key={column.id} className="w-72 flex flex-col">
              <h3 className="text-sm font-semibold text-text-secondary mb-sm px-sm">
                {column.label}
                <span className="text-text-muted ml-sm">({columnProjects.length})</span>
              </h3>

              <div className="flex-1 space-y-sm">
                {columnProjects.map((project) => (
                  <div
                    key={project.id}
                    className="bg-bg-card border border-border rounded-lg p-md hover:border-border-light transition-colors cursor-pointer"
                  >
                    <h4 className="text-text-primary text-sm font-medium mb-xs">
                      {project.title}
                    </h4>
                    <p className="text-text-muted text-xs mb-sm">
                      {new Date(project.updated_at).toLocaleDateString()}
                    </p>

                    {/* Progress ring */}
                    <div className="flex items-center gap-sm">
                      <div className="w-8 h-8 relative">
                        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                          <circle
                            cx="16"
                            cy="16"
                            r="12"
                            fill="none"
                            stroke="var(--color-border)"
                            strokeWidth="3"
                          />
                          <circle
                            cx="16"
                            cy="16"
                            r="12"
                            fill="none"
                            stroke="var(--color-accent-blue)"
                            strokeWidth="3"
                            strokeDasharray={`${project.progress * 75.4} 75.4`}
                            strokeLinecap="round"
                          />
                        </svg>
                      </div>
                      <span className="text-text-secondary text-xs">
                        {(project.progress * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}

                {columnProjects.length === 0 && (
                  <div className="text-center py-lg text-text-muted text-xs">
                    No projects
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
