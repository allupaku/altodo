import React, { useState } from 'react';
import type { EditCache } from './types';
import type { RecurrenceRule } from '../../../shared/models/todo';
import { computeCountFromEndDate, computeEndDateFromCount, updateRepeatPreview } from './todoUtils';
import TagChips from './TagChips';

interface DraftModalProps {
  open: boolean;
  cache: EditCache | null;
  tags: string[];
  onClose: () => void;
  onSave: () => void;
  onChange: (patch: Partial<EditCache>) => void;
  onUpdateTags: (tags: string[]) => void;
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

export default function DraftModal({ open, cache, tags, onClose, onSave, onChange, onUpdateTags }: DraftModalProps) {
  const [tagInput, setTagInput] = useState('');
  if (!open || !cache) return null;

  const hasRepeat = cache.recurrence && cache.recurrence !== 'none';
  const preview = updateRepeatPreview(
    cache.due || null,
    cache.recurrence,
    cache.recurrenceEnd || null,
    cache.recurrenceCount || null
  );

  function addTag() {
    const next = normalizeTag(tagInput);
    if (!next) return;
    onUpdateTags(uniqueTags([...(cache.tags || []), next]));
    setTagInput('');
  }

  return (
    <div className="draft-overlay" onClick={onSave}>
      <div className="draft-card" onClick={(event) => event.stopPropagation()}>
        <div className="draft-header">
          <div
            className="draft-title"
            contentEditable
            data-placeholder="Todo title"
            dir="ltr"
            style={{ unicodeBidi: 'plaintext' }}
            suppressContentEditableWarning
            onInput={(event) => {
              const next = (event.target as HTMLElement).innerText;
              onChange({ title: next });
            }}
          >
            {cache.title}
          </div>
          <button className="ghost icon" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="draft-meta">
          <div className="due-row">
            <input
              type="date"
              className="due-date"
              value={cache.due}
              onChange={(event) => {
                const due = event.target.value;
                let endDate = cache.recurrenceEnd || '';
                let endCount = cache.recurrenceCount ? String(cache.recurrenceCount) : '';
                if (hasRepeat) {
                  if (endCount) {
                    endDate = computeEndDateFromCount(due, cache.recurrence, endCount) || '';
                  } else if (endDate) {
                    const computed = computeCountFromEndDate(due, cache.recurrence, endDate);
                    endCount = computed ? String(computed) : '';
                  }
                }
                onChange({
                  due,
                  recurrenceEnd: endDate || null,
                  recurrenceCount: endCount ? Number(endCount) : null,
                });
              }}
            />
          </div>
          <label className="select">
            <span>Remind</span>
            <select
              value={cache.remind}
              onChange={(event) => onChange({ remind: event.target.value })}
            >
              <option value="none">None</option>
              <option value="5m">5 minutes before</option>
              <option value="30m">30 minutes before</option>
              <option value="1h">1 hour before</option>
              <option value="1d">1 day before</option>
            </select>
          </label>
          <label className="select">
            <span>Repeat</span>
            <select
              value={cache.recurrence}
              onChange={(event) => {
                const value = event.target.value as RecurrenceRule;
                let endDate = cache.recurrenceEnd || '';
                let endCount = cache.recurrenceCount ? String(cache.recurrenceCount) : '';
                if (value === 'none') {
                  endDate = '';
                  endCount = '';
                } else if (endCount) {
                  endDate = computeEndDateFromCount(cache.due, value, endCount) || '';
                } else if (endDate) {
                  const computed = computeCountFromEndDate(cache.due, value, endDate);
                  endCount = computed ? String(computed) : '';
                }
                onChange({
                  recurrence: value,
                  recurrenceEnd: endDate || null,
                  recurrenceCount: endCount ? Number(endCount) : null,
                });
              }}
            >
              <option value="none">No repeat</option>
              <option value="daily">Every day</option>
              <option value="weekdays">Every weekday</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="weekly:1">Every Monday</option>
              <option value="weekly:2">Every Tuesday</option>
              <option value="weekly:3">Every Wednesday</option>
              <option value="weekly:4">Every Thursday</option>
              <option value="weekly:5">Every Friday</option>
              <option value="weekly:6">Every Saturday</option>
              <option value="weekly:0">Every Sunday</option>
              <option value="monthly">Every month</option>
            </select>
          </label>
          {hasRepeat && (
            <>
              <label className="select">
                <span>End date</span>
                <input
                  type="date"
                  className="due-date inline"
                  value={cache.recurrenceEnd || ''}
                  onChange={(event) => {
                    const next = event.target.value;
                    const count = computeCountFromEndDate(cache.due, cache.recurrence, next);
                    onChange({
                      recurrenceEnd: next || null,
                      recurrenceCount: count ?? null,
                    });
                  }}
                />
              </label>
              <label className="select">
                <span>Occurrences</span>
                <input
                  type="number"
                  min={1}
                  className="due-date inline"
                  value={cache.recurrenceCount ? String(cache.recurrenceCount) : ''}
                  onChange={(event) => {
                    const next = event.target.value;
                    const computed = computeEndDateFromCount(cache.due, cache.recurrence, next);
                    onChange({
                      recurrenceCount: next ? Number(next) : null,
                      recurrenceEnd: computed || null,
                    });
                  }}
                />
              </label>
            </>
          )}
          <label className="select tag-row">
            <span>Tags</span>
            <div className="tag-input">
              <input
                type="text"
                list="tagSuggestions"
                placeholder="Add tag"
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
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
        {hasRepeat && <div className="repeat-preview">{preview}</div>}
        <TagChips
          tags={cache.tags || []}
          removable
          onRemove={(tag) => onUpdateTags(cache.tags.filter((item) => item !== tag))}
        />
        <div
          className="draft-body"
          contentEditable
          data-placeholder="Details..."
          dir="ltr"
          style={{ unicodeBidi: 'plaintext' }}
          suppressContentEditableWarning
          onInput={(event) => {
            const next = (event.target as HTMLElement).innerText;
            onChange({ body: next });
          }}
        >
          {cache.body}
        </div>
        <div className="draft-actions">
          <button className="primary icon" type="button" onClick={onSave}>
            ✓
          </button>
        </div>
        <datalist id="tagSuggestions">
          {tags.map((tag) => (
            <option key={tag} value={tag} />
          ))}
        </datalist>
      </div>
    </div>
  );
}
