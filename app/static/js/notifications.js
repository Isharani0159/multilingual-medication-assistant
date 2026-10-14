/* notifications.js
   PURPOSE: Shows a reminder when a dose time arrives (in-page toast + optional browser notification).
   LIMITS: Works only while the page is open. Browsers may pause background tabs and phones may block
           notifications, so this is NOT a guaranteed alarm. The UI says so.
   DEPENDS ON: i18n.js (t), app.js (toast) */

const Reminders = (() => {
  const notified = new Set(); // dose ids already announced (so we do not repeat)

  /** Asks the browser for notification permission (must be triggered by a click). */
  async function enable() {
    if (!("Notification" in window)) { toast(t("notif_unsupported"), "error"); return; }
    const result = await Notification.requestPermission();
    toast(result === "granted" ? t("notif_on") : t("notif_blocked"), result === "granted" ? "info" : "error");
    updateButton();
  }

  /** Hides the enable button when permission is already granted or notifications are unsupported. */
  function updateButton() {
    const btn = document.getElementById("btn-notify");
    if (btn) btn.hidden = !("Notification" in window) || Notification.permission === "granted";
  }

  /** Looks through today's doses and announces any whose time has arrived. Called every 30 s by app.js. */
  function check(doses) {
    const now = new Date();
    doses.forEach(d => {
      if (!["upcoming", "due"].includes(d.status) || notified.has(d.id)) return;
      const dueAt = new Date(`${d.scheduled_date}T${d.scheduled_time}`); // parsed as local time
      if (now >= dueAt) { notified.add(d.id); fire(d); }
    });
  }

  /** Displays one reminder in the page and, if allowed, as a system notification. */
  function fire(dose) {
    const message = `${t("reminder_due")}: ${dose.name} (${dose.dose})`;
    toast(message, "reminder");
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(t("app_name"), { body: message });
    }
  }

  return { enable, check, updateButton };
})();