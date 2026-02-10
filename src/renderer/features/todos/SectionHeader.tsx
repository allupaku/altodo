import React from 'react';
import type { TodoListItem } from '../../../shared/models/todo';

interface SectionHeaderProps {
  label: string;
  items: TodoListItem[];
  onBulkDone: () => void;
  onBulkDelete: () => void;
}

export default function SectionHeader({ label, items, onBulkDone, onBulkDelete }: SectionHeaderProps) {
  if (!items.length) return null;
  return (
    <div className="section-header with-actions">
      <span>{label}</span>
      <div className="section-actions">
        <button className="icon plain" title={`Mark ${label} todos as done`} type="button" onClick={onBulkDone}>
          ✓✓
        </button>
        <button
          className="icon plain danger-text"
          title={`Delete ${label} todos`}
          type="button"
          onClick={onBulkDelete}
        >
          🧹
        </button>
      </div>
    </div>
  );
}
