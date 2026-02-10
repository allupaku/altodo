import React, { useState } from 'react';
import TagChips from './TagChips';

interface TagModalProps {
  open: boolean;
  tags: string[];
  suggestions: string[];
  onClose: () => void;
  onChange: (tags: string[]) => void;
  onConfirm: () => void;
}

function normalizeTag(value: string) {
  return value.trim();
}

function uniqueTags(tags: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  tags.forEach((tag) => {
    const clean = normalizeTag(tag);
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  });
  return result;
}

export default function TagModal({ open, tags, suggestions, onClose, onChange, onConfirm }: TagModalProps) {
  const [inputValue, setInputValue] = useState('');
  if (!open) return null;

  function addTag() {
    const next = normalizeTag(inputValue);
    if (!next) return;
    const updated = uniqueTags([...tags, next]);
    onChange(updated);
    setInputValue('');
  }

  return (
    <div className="draft-overlay" onClick={onClose}>
      <div className="draft-card" onClick={(event) => event.stopPropagation()}>
        <div className="draft-header">
          <div className="draft-title">Tags</div>
          <button className="ghost icon" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="draft-meta">
          <label className="select tag-row">
            <span>Tags</span>
            <div className="tag-input">
              <input
                type="text"
                list="tagSuggestions"
                placeholder="Add tag"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  addTag();
                }}
              />
              <button className="ghost" type="button" onClick={addTag}>
                Add
              </button>
            </div>
          </label>
        </div>
        <TagChips
          tags={tags}
          removable
          onRemove={(tag) => onChange(tags.filter((item) => item !== tag))}
        />
        <div className="draft-actions">
          <button className="primary icon" type="button" onClick={onConfirm}>
            ✓
          </button>
        </div>
        <datalist id="tagSuggestions">
          {suggestions.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
