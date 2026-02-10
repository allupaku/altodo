import React from 'react';
import type { RecurrenceRule } from '../../../shared/models/todo';
import { computeCountFromEndDate, computeEndDateFromCount, updateRepeatPreview } from './todoUtils';

interface RecurrenceModalProps {
  open: boolean;
  recurrence: RecurrenceRule;
  endDate: string;
  endCount: string;
  baseDue: string;
  onChange: (patch: { recurrence?: RecurrenceRule; endDate?: string; endCount?: string }) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function RecurrenceModal({
  open,
  recurrence,
  endDate,
  endCount,
  baseDue,
  onChange,
  onClose,
  onSave,
}: RecurrenceModalProps) {
  if (!open) return null;
  const hasRepeat = recurrence && recurrence !== 'none';
  const preview = updateRepeatPreview(baseDue, recurrence, endDate || null, endCount || null);

  return (
    <div className="draft-overlay" onClick={onClose}>
      <div className="draft-card" onClick={(event) => event.stopPropagation()}>
        <div className="draft-header">
          <div className="draft-title">Recurrence</div>
          <button className="ghost icon" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="draft-meta">
          <label className="select">
            <span>Repeat</span>
            <select
              value={recurrence}
              onChange={(event) => {
                const value = event.target.value as RecurrenceRule;
                let nextEndDate = endDate;
                let nextEndCount = endCount;
                if (value === 'none') {
                  nextEndDate = '';
                  nextEndCount = '';
                } else if (nextEndCount) {
                  nextEndDate =
                    computeEndDateFromCount(baseDue, value, nextEndCount) || nextEndDate;
                } else if (nextEndDate) {
                  const computed = computeCountFromEndDate(baseDue, value, nextEndDate);
                  nextEndCount = computed ? String(computed) : '';
                }
                onChange({ recurrence: value, endDate: nextEndDate, endCount: nextEndCount });
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
                  value={endDate}
                  onChange={(event) => {
                    const nextEndDate = event.target.value;
                    const computed = computeCountFromEndDate(baseDue, recurrence, nextEndDate);
                    onChange({ endDate: nextEndDate, endCount: computed ? String(computed) : '' });
                  }}
                />
              </label>
              <label className="select">
                <span>Occurrences</span>
                <input
                  type="number"
                  min={1}
                  className="due-date inline"
                  value={endCount}
                  onChange={(event) => {
                    const nextCount = event.target.value;
                    const computed = computeEndDateFromCount(baseDue, recurrence, nextCount);
                    onChange({ endCount: nextCount, endDate: computed || '' });
                  }}
                />
              </label>
            </>
          )}
        </div>
        {hasRepeat && <div className="repeat-preview">{preview}</div>}
        <div className="draft-actions">
          <button className="primary icon" type="button" onClick={onSave}>
            ✓
          </button>
        </div>
      </div>
    </div>
  );
}
