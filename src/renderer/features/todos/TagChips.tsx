import React from 'react';

interface TagChipsProps {
  tags: string[];
  removable?: boolean;
  onRemove?: (tag: string) => void;
}

export default function TagChips({ tags, removable = false, onRemove }: TagChipsProps) {
  if (!tags.length) return null;
  return (
    <div className="tag-list">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
          {removable && (
            <button
              type="button"
              title="Remove tag"
              onClick={(event) => {
                event.stopPropagation();
                onRemove?.(tag);
              }}
            >
              ×
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
