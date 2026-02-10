import React from 'react';
import type { AppSettings, DisplayInfo } from '../../../shared/models/settings';

interface SettingsPanelProps {
  open: boolean;
  settings: AppSettings | null;
  displays: DisplayInfo[];
  onClose: () => void;
  onUpdate: (next: Partial<AppSettings>) => void;
}

export default function SettingsPanel({ open, settings, displays, onClose, onUpdate }: SettingsPanelProps) {
  if (!settings) return null;

  const displayValue = settings.displayId ?? '';
  const widthValue = settings.widthValue;

  function handleWidthModeChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const widthMode = event.target.value as AppSettings['widthMode'];
    let widthValueNext = Number(widthValue);
    if (widthMode === 'percent') {
      widthValueNext = Math.max(10, Math.min(widthValueNext || 25, 80));
    } else {
      widthValueNext = Math.max(260, widthValueNext || 360);
    }
    onUpdate({ widthMode, widthValue: widthValueNext });
  }

  function handleWidthValueChange(event: React.ChangeEvent<HTMLInputElement>) {
    const raw = Number(event.target.value);
    let nextValue = raw;
    if (settings.widthMode === 'percent') {
      nextValue = Math.max(10, Math.min(raw || 25, 80));
    } else {
      nextValue = Math.max(260, raw || 360);
    }
    onUpdate({ widthValue: nextValue });
  }

  return (
    <>
      <div className={`panel-overlay ${open ? 'open' : ''}`} onClick={onClose} />
      <aside className={`panel-drawer ${open ? 'open' : ''}`}>
        <div className="panel-header">
          <div>Settings</div>
          <button className="ghost" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="panel-body">
        <div className="setting-block">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.alwaysOnTop}
              onChange={(event) => onUpdate({ alwaysOnTop: event.target.checked })}
            />
            <span>Always on top</span>
          </label>
          <div className="setting-help">Keeps Todo Bar above other windows.</div>
        </div>
        <div className="setting-block">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.dockRight}
              onChange={(event) => onUpdate({ dockRight: event.target.checked })}
            />
            <span>Dock right</span>
          </label>
          <div className="setting-help">Pin the sidebar to the right edge of the screen.</div>
        </div>
        {displays.length > 1 && (
          <div className="setting-block">
            <label className="select">
              <span>Display</span>
              <select
                value={displayValue}
                onChange={(event) => onUpdate({ displayId: Number(event.target.value) })}
              >
                {displays.map((display) => (
                  <option key={display.id} value={display.id}>
                    {display.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="setting-help">Choose which monitor the sidebar uses.</div>
          </div>
        )}
        <div className="setting-block">
          <div className="width-row">
            <label className="select">
              <span>Width</span>
              <input
                type="number"
                min={settings.widthMode === 'percent' ? 10 : 260}
                max={settings.widthMode === 'percent' ? 80 : 800}
                step={settings.widthMode === 'percent' ? 1 : 10}
                value={widthValue}
                onChange={handleWidthValueChange}
              />
            </label>
            <label className="select">
              <span>Unit</span>
              <select value={settings.widthMode} onChange={handleWidthModeChange}>
                <option value="px">px</option>
                <option value="percent">%</option>
              </select>
            </label>
          </div>
          <div className="setting-help">Adjust how much horizontal space the app takes.</div>
        </div>
        <div className="setting-block">
          <label className="select">
            <span>Todos folder</span>
            <input
              type="text"
              value={settings.todosDir || ''}
              placeholder="/Users/you/TODOS"
              onChange={(event) => onUpdate({ todosDir: event.target.value || null })}
            />
          </label>
          <div className="setting-help">Where your Markdown todo files are stored.</div>
        </div>
        <div className="setting-block">
          <label className="select">
            <span>Reminder time</span>
            <input
              type="time"
              value={settings.reminderTime}
              onChange={(event) => onUpdate({ reminderTime: event.target.value })}
            />
          </label>
          <div className="setting-help">Daily reminder check for all due items.</div>
        </div>
        <div className="setting-block">
          <label className="toggle">
            <input
              type="checkbox"
              checked={settings.gitEnabled}
              onChange={(event) => onUpdate({ gitEnabled: event.target.checked })}
            />
            <span>Git sync</span>
          </label>
          <div className="setting-help">Auto-commit and push changes to your repo.</div>
        </div>
        </div>
      </aside>
    </>
  );
}
