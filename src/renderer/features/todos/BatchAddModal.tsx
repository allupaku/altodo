import React from 'react';

interface BatchAddModalProps {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function BatchAddModal({ open, value, onChange, onClose, onSave }: BatchAddModalProps) {
  if (!open) return null;
  return (
    <div className="draft-overlay" onClick={onClose}>
      <div className="draft-card" onClick={(event) => event.stopPropagation()}>
        <div className="draft-header">
          <div className="draft-title">Batch add</div>
          <button className="ghost icon" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <div className="batch-help">
          <div>One item per line. Examples:</div>
          <div className="batch-example">Follow up with design /tags:meeting @2026-02-12</div>
          <div className="batch-example">Prep 1:1 notes /tags:manager,followup</div>
        </div>
        <textarea
          className="batch-input"
          placeholder="Add todos..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <div className="draft-actions">
          <button className="primary" type="button" onClick={onSave}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
