import { notificationService } from "../customer/services/notifications/notificationService.js";

let intervalHandle: NodeJS.Timeout | null = null;

export const startNotificationScheduler = () => {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const intervalMs = Number(process.env.NOTIFICATION_SCHEDULER_INTERVAL_MS || String(15 * 60 * 1000));

  const tick = async () => {
    try {
      await notificationService.generateScheduledNotifications();
      await notificationService.processPendingNotifications();
    } catch (error) {
      console.error("[NotificationScheduler] Failed to run scheduled notification cycle", error);
    }
  };

  tick();
  intervalHandle = setInterval(tick, intervalMs);
  console.log(`[NotificationScheduler] Started with interval ${intervalMs}ms`);
};

export const stopNotificationScheduler = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
};
