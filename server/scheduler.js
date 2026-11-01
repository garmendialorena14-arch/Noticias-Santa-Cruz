import { getSettings } from './db.js';
import { todayLocal } from './lib/dates.js';
import { runDailyBackfill, runRefresh } from './refresh.js';

let timer = null;
let nextRunAt = null;
let lastScheduleError = null;
let lastRecordedDay = null;

function scheduleNext(delayMs) {
  if (timer) clearTimeout(timer);
  nextRunAt = new Date(Date.now() + delayMs).toISOString();
  timer = setTimeout(async () => {
    try {
      const today = todayLocal();
      const isNewDay = lastRecordedDay && today !== lastRecordedDay;
      if (isNewDay) {
        console.log(`[scheduler] Cambio de fecha detectado (${lastRecordedDay} -> ${today}). Iniciando relevamiento del nuevo día...`);
      }
      lastRecordedDay = today;

      await runRefresh('scheduler');

      if (isNewDay) {
        const backfillDays = Number(getSettings().daily_backfill_days) || 3;
        if (backfillDays > 0) {
          console.log(`[scheduler] Ejecutando backfill diario de los últimos ${backfillDays} días...`);
          await runDailyBackfill(backfillDays);
        }
      }
    } catch (error) {
      lastScheduleError = error.message;
      console.error('[scheduler] Error al actualizar:', error.message);
    } finally {
      const minutes = Number(getSettings().refresh_minutes) || 30;
      scheduleNext(minutes * 60_000);
    }
  }, delayMs);
}

export function startScheduler() {
  const settings = getSettings();
  const minutes = Number(settings.refresh_minutes) || 30;
  const initialDelay = process.env.AUTO_REFRESH === '0' ? minutes * 60_000 : 4_000;
  lastRecordedDay = todayLocal();

  if (timer) clearTimeout(timer);
  scheduleNext(initialDelay);
  console.log(
    `[scheduler] Actualización automática cada ${minutes} minutos. ` +
      `Próxima: ${nextRunAt} (Fecha local: ${lastRecordedDay})`
  );

  const backfillDays = Number(settings.daily_backfill_days) || 3;
  if (backfillDays > 0) {
    setTimeout(() => {
      runDailyBackfill(backfillDays).catch((error) => {
        console.warn('[scheduler] Error en backfill de inicio:', error.message);
      });
    }, 15_000);
  }
}

export function reschedule() {
  startScheduler();
}

export function getSchedulerInfo() {
  const settings = getSettings();
  return {
    intervalMinutes: Number(settings.refresh_minutes) || 30,
    nextRunAt,
    lastScheduleError
  };
}

export function stopScheduler() {
  if (timer) clearTimeout(timer);
  timer = null;
  nextRunAt = null;
}
