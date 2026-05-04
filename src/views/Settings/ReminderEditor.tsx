import { useEffect, useState } from "react";
import { db } from "../../db";
import { Modal } from "../../components/Modal";
import { MEAL_SLOTS, MEAL_SLOT_LABEL, type MealSlot } from "../../models/Meal";
import type { NotificationSchedule } from "../../models/NotificationSchedule";

interface Props {
  open: boolean;
  schedule: NotificationSchedule;
  onClose: () => void;
}

const WEEKDAY_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

export function ReminderEditor({ open, schedule, onClose }: Props) {
  const [hour, setHour] = useState(schedule.hour);
  const [minute, setMinute] = useState(schedule.minute);
  const [weekdays, setWeekdays] = useState<number[]>(schedule.weekdays);
  const [mealSlot, setMealSlot] = useState<MealSlot | undefined>(schedule.mealSlot);
  const [isEnabled, setIsEnabled] = useState(schedule.isEnabled);
  const [customMessage, setCustomMessage] = useState(schedule.customMessage ?? "");

  useEffect(() => {
    setHour(schedule.hour);
    setMinute(schedule.minute);
    setWeekdays(schedule.weekdays);
    setMealSlot(schedule.mealSlot);
    setIsEnabled(schedule.isEnabled);
    setCustomMessage(schedule.customMessage ?? "");
  }, [schedule]);

  const toggleDay = (day: number) => {
    setWeekdays((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      return [...prev, day].sort((a, b) => a - b);
    });
  };

  const save = async () => {
    if (schedule.id === undefined) return;
    await db.notificationSchedules.update(schedule.id, {
      hour,
      minute,
      weekdays,
      mealSlot,
      isEnabled,
      customMessage: customMessage.trim() || undefined,
    });
    onClose();
  };

  const remove = async () => {
    if (schedule.id === undefined) return;
    await db.notificationSchedules.delete(schedule.id);
    onClose();
  };

  const timeStr = `${pad(hour)}:${pad(minute)}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={schedule.type === "bpReminder" ? "BP reminder" : "Meal reminder"}
      primaryAction={{ label: "Done", onClick: save }}
    >
      <div className="form-stack">
        <div className="field">
          <label className="field-label" htmlFor="time">Time</label>
          <input
            id="time"
            type="time"
            className="text-input"
            value={timeStr}
            onChange={(e) => {
              const [h, m] = e.target.value.split(":").map(Number);
              if (Number.isFinite(h)) setHour(h!);
              if (Number.isFinite(m)) setMinute(m!);
            }}
          />
        </div>

        <div className="field">
          <div className="field-label">Repeat</div>
          <div className="weekday-row">
            {WEEKDAY_SHORT.map((label, i) => {
              const active = weekdays.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  className={`weekday-btn ${active ? "weekday-btn--active" : ""}`}
                  onClick={() => toggleDay(i)}
                  aria-label={`Toggle weekday ${i}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {schedule.type === "mealReminder" ? (
          <div className="field">
            <div className="field-label">Meal slot</div>
            <div className="seg">
              {MEAL_SLOTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`seg__btn ${mealSlot === s ? "seg__btn--active" : ""}`}
                  onClick={() => setMealSlot(s)}
                >
                  {MEAL_SLOT_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="field">
          <label className="field-label" htmlFor="msg">Custom message <span style={{ textTransform: "none", fontWeight: 400 }}>(optional)</span></label>
          <textarea
            id="msg"
            className="textarea-input"
            rows={2}
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
          />
        </div>

        <label className="toggle-row">
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
          />
        </label>

        <button type="button" className="btn btn--danger" onClick={remove} style={{ marginTop: "var(--sp-md)" }}>
          Delete reminder
        </button>
      </div>
    </Modal>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
