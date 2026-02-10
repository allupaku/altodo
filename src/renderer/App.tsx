import React from 'react';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="title">Todo Bar</div>
          <div className="subtitle">Markdown-backed, always-ready.</div>
        </div>
      </header>
      <main className="app-main">
        <div className="empty-state">Migration in progress…</div>
      </main>
    </div>
  );
}
