import React from 'react';
import { groupNodesByStage } from '../../library/studioGraph.js';

export default function StudioKanbanView({ project, onSelectNode }) {
  const columns = groupNodesByStage(project);

  return (
    <div className="studio-kanban">
      {columns.map((col) => (
        <section key={col.id} className="studio-kanban-column">
          <header className="studio-kanban-column-header">{col.label}</header>
          <div className="studio-kanban-column-body">
            {col.nodes.map((node) => (
              <button
                key={node.id}
                type="button"
                className={`studio-kanban-card studio-status-${node.status || 'idle'}`}
                onClick={() => onSelectNode?.(node.id)}
              >
                <div className="studio-kanban-card-title">{node.label}</div>
                <div className="studio-kanban-card-meta">{node.status}</div>
                {node.kind === 'text_prompt' && node.data?.prompt ? (
                  <p className="studio-kanban-card-preview">{node.data.prompt}</p>
                ) : null}
                {node.data?.imageUrl ? (
                  <p className="studio-kanban-card-preview">Image ready</p>
                ) : null}
                {node.data?.meshUrl ? (
                  <p className="studio-kanban-card-preview">Mesh ready</p>
                ) : null}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
