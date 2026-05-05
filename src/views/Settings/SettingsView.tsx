import { useEffect, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import {
  getNotificationStatus,
  isIosSafari,
  isStandalone,
  requestNotificationPermission,
  type NotificationStatus,
} from "../../services/notifications";
import {
  downloadExport,
  readImportFile,
  replaceFromExport,
} from "../../services/dataExport";
import type { NotificationSchedule } from "../../models/NotificationSchedule";
import { MEAL_SLOT_LABEL } from "../../models/Meal";
import { ReminderEditor } from "./ReminderEditor";
import { GoalsSection } from "./GoalsSection";
import { AIFeedbackSection } from "./AIFeedbackSection";
import { useDeferredUnmount } from "../../services/useDeferredUnmount";
import { useAlert } from "../../components/AlertProvider";
import { LargeTitlePage } from "../../components/LargeTitlePage";
import "./settings.css";

export default function SettingsView() {
  return (
    <LargeTitlePage title="Settings">
      <GoalsSection />
      <RemindersSection />
      <AIFeedbackSection />
      <DataSection />
      <InstallSection />
    </LargeTitlePage>
  );
}

function RemindersSection() {
  const schedules = useLiveQuery(
    () => db.notificationSchedules.toArray(),
    [],
    [] as NotificationSchedule[],
  );

  const [permission, setPermission] = useState<NotificationStatus>(getNotificationStatus());
  const [editing, setEditing] = useState<NotificationSchedule | null>(null);
  const editingDeferred = useDeferredUnmount(editing, 320);

  useEffect(() => {
    setPermission(getNotificationStatus());
  }, []);

  const enable = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
  };

  const addBP = async () => {
    const id = await db.notificationSchedules.add({
      type: "bpReminder",
      hour: 8,
      minute: 0,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      isEnabled: true,
    });
    const schedule = await db.notificationSchedules.get(Number(id));
    if (schedule) setEditing(schedule);
  };

  const addMeal = async () => {
    const id = await db.notificationSchedules.add({
      type: "mealReminder",
      hour: 12,
      minute: 0,
      weekdays: [0, 1, 2, 3, 4, 5, 6],
      mealSlot: "lunch",
      isEnabled: true,
    });
    const schedule = await db.notificationSchedules.get(Number(id));
    if (schedule) setEditing(schedule);
  };

  const toggleEnabled = async (schedule: NotificationSchedule) => {
    if (schedule.id === undefined) return;
    await db.notificationSchedules.update(schedule.id, { isEnabled: !schedule.isEnabled });
  };

  const bpSchedules = schedules.filter((s) => s.type === "bpReminder");
  const mealSchedules = schedules.filter((s) => s.type === "mealReminder");

  return (
    <>
      <section className="settings-section">
        <h2 className="settings-section__title">Reminders</h2>
        <PermissionBanner permission={permission} onEnable={enable} />
        {(isIosSafari() && !isStandalone()) ? (
          <div className="card settings-warn">
            <strong>iPhone tip:</strong> Add this site to your home screen first (Share → Add to Home Screen). Safari blocks notifications from regular tabs.
          </div>
        ) : null}
        <p className="muted settings-fineprint">
          Reminders fire while the app is open in a tab or recently used as an installed PWA. There's no server pushing them, so closing the app indefinitely will eventually stop reminders.
        </p>

        <div className="settings-block">
          <div className="settings-block__header">
            <h3 className="settings-block__title">BP reminders</h3>
            <button type="button" className="btn btn--ghost" onClick={addBP}>+ Add</button>
          </div>
          {bpSchedules.length === 0 ? (
            <p className="muted settings-empty">No BP reminders yet.</p>
          ) : (
            <ul className="settings-list">
              {bpSchedules.map((s) => (
                <ScheduleRow key={s.id} schedule={s} onTap={() => setEditing(s)} onToggle={() => toggleEnabled(s)} />
              ))}
            </ul>
          )}
        </div>

        <div className="settings-block">
          <div className="settings-block__header">
            <h3 className="settings-block__title">Meal reminders</h3>
            <button type="button" className="btn btn--ghost" onClick={addMeal}>+ Add</button>
          </div>
          {mealSchedules.length === 0 ? (
            <p className="muted settings-empty">No meal reminders yet.</p>
          ) : (
            <ul className="settings-list">
              {mealSchedules.map((s) => (
                <ScheduleRow key={s.id} schedule={s} onTap={() => setEditing(s)} onToggle={() => toggleEnabled(s)} />
              ))}
            </ul>
          )}
        </div>
      </section>

      {editingDeferred ? (
        <ReminderEditor open={Boolean(editing)} schedule={editingDeferred} onClose={() => setEditing(null)} />
      ) : null}
    </>
  );
}

function PermissionBanner({ permission, onEnable }: { permission: NotificationStatus; onEnable: () => void }) {
  if (permission === "granted") {
    return <div className="card settings-ok">✓ Notifications enabled</div>;
  }
  if (permission === "denied") {
    return (
      <div className="card settings-warn">
        Notifications are blocked. Re-enable them in your browser settings for this site.
      </div>
    );
  }
  if (permission === "unsupported") {
    return (
      <div className="card settings-warn">
        This browser doesn't support notifications.
      </div>
    );
  }
  return (
    <button type="button" className="card settings-cta" onClick={onEnable}>
      Enable notifications
    </button>
  );
}

function ScheduleRow({
  schedule,
  onTap,
  onToggle,
}: {
  schedule: NotificationSchedule;
  onTap: () => void;
  onToggle: () => void;
}) {
  const time = formatTime(schedule.hour, schedule.minute);
  return (
    <li className="settings-row">
      <button type="button" className="settings-row__main" onClick={onTap}>
        <div>
          <div className="settings-row__time mono">{time}</div>
          <div className="muted settings-row__sub">{weekdaySummary(schedule.weekdays)}</div>
          {schedule.mealSlot ? (
            <div className="muted settings-row__slot">{MEAL_SLOT_LABEL[schedule.mealSlot]}</div>
          ) : null}
        </div>
      </button>
      <label className="toggle-row toggle-row--inline">
        <input type="checkbox" checked={schedule.isEnabled} onChange={onToggle} />
      </label>
    </li>
  );
}

function DataSection() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const confirm = useAlert();

  const onExport = async () => {
    try {
      await downloadExport();
      setStatus("Backup downloaded.");
    } catch (err) {
      setStatus(`Export failed: ${(err as Error).message}`);
    }
  };

  const onImportClick = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow picking the same file again
    if (!file) return;
    try {
      const data = await readImportFile(file);
      const ok = await confirm({
        title: "Replace all data?",
        message: `Import ${data.readings.length} readings, ${data.meals.length} meals, ${data.mealPlan.length} plan entries. Your current data will be erased.`,
        confirmLabel: "Replace",
        destructive: true,
      });
      if (!ok) return;
      await replaceFromExport(data);
      setStatus("Import complete.");
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    }
  };

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">Data</h2>
      <p className="muted settings-fineprint">
        Everything is stored on this device only. Export to back up. Importing replaces all existing data.
      </p>
      <div className="settings-actions">
        <button type="button" className="btn btn--primary" onClick={onExport}>
          Download backup (.json)
        </button>
        <button type="button" className="btn btn--ghost" onClick={onImportClick}>
          Restore from backup
        </button>
        <input
          type="file"
          accept="application/json,.json"
          ref={fileInputRef}
          onChange={onFileChange}
          style={{ display: "none" }}
        />
      </div>
      {status ? <p className="muted settings-status">{status}</p> : null}
    </section>
  );
}

function InstallSection() {
  const installed = isStandalone();
  const ios = isIosSafari();

  if (installed) {
    return (
      <section className="settings-section">
        <h2 className="settings-section__title">Installed</h2>
        <div className="card settings-ok">✓ Running as an installed app on this device.</div>
      </section>
    );
  }

  return (
    <section className="settings-section">
      <h2 className="settings-section__title">Install on your phone</h2>
      {ios ? (
        <ol className="settings-steps">
          <li>Tap the <strong>Share</strong> button at the bottom of Safari (square with up arrow).</li>
          <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          <li>Open Pulse from the home-screen icon — it runs fullscreen.</li>
        </ol>
      ) : (
        <ol className="settings-steps">
          <li>Open this site in your phone's browser.</li>
          <li>From the browser menu, tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
          <li>Launch it from the home-screen icon.</li>
        </ol>
      )}
    </section>
  );
}

function formatTime(hour: number, minute: number): string {
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function weekdaySummary(days: number[]): string {
  if (days.length === 7) return "Every day";
  const weekdaysSet = new Set(days);
  if ([1, 2, 3, 4, 5].every((d) => weekdaysSet.has(d)) && weekdaysSet.size === 5) return "Weekdays";
  if ([0, 6].every((d) => weekdaysSet.has(d)) && weekdaysSet.size === 2) return "Weekends";
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return [...days].sort().map((d) => labels[d]).join(" ");
}
