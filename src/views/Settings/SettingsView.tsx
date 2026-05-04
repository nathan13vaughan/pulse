export default function SettingsView() {
  return (
    <>
      <header className="view-header">
        <h1>Settings</h1>
      </header>
      <div className="scroll-area">
        <div className="card">
          <div className="section-label">Coming next</div>
          <p className="muted" style={{ marginTop: "var(--sp-xs)" }}>
            Notification reminders, JSON export/import for backup, and a "how to install on iPhone" guide.
          </p>
        </div>
      </div>
    </>
  );
}
