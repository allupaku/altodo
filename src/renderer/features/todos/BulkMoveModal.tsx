import React from 'react';

interface BulkMoveModalProps {
  open: boolean;
  label: string;
  count: number;
  targetDate: string;
  onChangeDate: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function BulkMoveModal({
  open,
  label,
  count,
  targetDate,
  onChangeDate,
  onClose,
  onConfirm,
}: BulkMoveModalProps) {
  if (!open) return null;
  return (
    <div className="draft-overlay" onClick={onClose}>
      <div className="draft-card" onClick={(event) => event.stopPropagation()}>
        <div className="draft-header">
          <div className="draft-title">Move {count} items</div>
          <button className="ghost icon" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="bulk-move-summary">
          From: <strong>{label}</strong>
        </div>
        <label className="select">
          <span>Move to date</span>
          <input
            type="date"
            className="due-date inline"
            value={targetDate}
            onChange={(event) => onChangeDate(event.target.value)}
          />
        </label>
        <div className="draft-actions">
          <button className="primary" type="button" onClick={onConfirm}>
            Move
          </button>
        </div>
      </div>
    </div>
  );
}
