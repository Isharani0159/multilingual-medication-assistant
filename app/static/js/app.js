/* app.js
   PURPOSE: Main frontend logic - navigation, loading data from the API, drawing the UI.
   DEPENDS ON: i18n.js (t, setLang), notifications.js (Reminders), API routes in /api/*
   SECURITY NOTE: user text is inserted with textContent (via h()), never innerHTML. */

const state = { view: "today", doses: [], meds: [], editId: null, report: null };
const $ = sel => document.querySelector(sel);
const pad = n => String(n).padStart(2, "0");

/** Returns today's date in the user's LOCAL timezone as YYYY-MM-DD. */
function localDate(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

/** Returns the user's current LOCAL date-time as YYYY-MM-DDTHH:MM (sent to the server). */
function localNow() { const d = new Date(); return `${localDate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`; }

/** Tiny safe element builder: h("div", {class:"x"}, "text", childElement). Text is never parsed as HTML. */
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  kids.flat().forEach(kid => { if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid)); });
  return el;
}

/** Shows a temporary message at the top of the screen. kind: info | error | reminder. */
function toast(message, kind = "info") {
  const el = h("div", { class: `toast ${kind}`, role: "status" }, message);
  $("#toast-area").append(el);
  setTimeout(() => el.remove(), 6000);
}

/** Calls the backend and returns JSON. Throws an Error with a readable message on failure. */
async function api(path, options = {}) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...options });
  if (!res.ok) {
    let message = t("error_generic");
    try {
      const body = await res.json();
      if (typeof body.detail === "string") message = body.detail;
    } catch (_) { /* keep generic message */ }
    throw new Error(message);
  }
  return res.json();
}

/** Creates a coloured status badge using the translated status name. */
function badge(status) { return h("span", { class: `badge badge-${status}` }, t(`st_${status}`)); }

/** Creates a friendly empty-state box with an optional action button. */
function emptyState(text, actionLabel, onAction) {
  return h("div", { class: "empty card" }, h("p", {}, text),
    actionLabel ? h("button", { class: "btn btn-primary", onclick: onAction }, actionLabel) : null);
}

/* ===================== Navigation ===================== */

/** Shows one view (today / meds / report / chat), updates nav highlight and page title, loads its data. */
function showView(name) {
  state.view = name;
  document.querySelectorAll(".view").forEach(v => { v.hidden = v.id !== `view-${name}`; });
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === name));
  $("#page-title").textContent = t(`title_${name}`);
  if (name === "today") loadToday();
  if (name === "meds") loadMeds();
  if (name === "report") loadReport();
}

/** Called by i18n.js after the language changes: redraws whatever is on screen. */
function onLanguageChange() {
  $("#page-title").textContent = t(`title_${state.view}`);
  renderToday(); renderMeds(); renderReport();
  if (!$("#med-form").hidden) $("#form-title").textContent = t(state.editId ? "edit_med" : "add_med");
}

/* ===================== TODAY ===================== */

/** Fetches today's doses from the API, then draws them. */
async function loadToday() {
  try {
    state.doses = await api(`/api/doses?day=${localDate()}&now=${encodeURIComponent(localNow())}`);
    renderToday();
  } catch (e) { toast(e.message, "error"); }
}

/** Draws the next-action card, status summary and the list of dose cards. */
function renderToday() {
  const doses = state.doses;
  const count = s => doses.filter(d => d.status === s).length;

  // Summary chips (upcoming + due are shown together as "Upcoming")
  const chips = [
    ["taken", count("taken")], ["upcoming", count("upcoming") + count("due")],
    ["pending_confirmation", count("pending_confirmation")], ["skipped", count("skipped")], ["missed", count("missed")],
  ];
  $("#summary").replaceChildren(...chips.map(([s, n]) => h("div", { class: "chip" }, h("b", {}, n), h("span", {}, t(`st_${s}`)))));

  // Next-action card: due now > needs confirmation > next upcoming
  const next = doses.find(d => d.status === "due") || doses.find(d => d.status === "pending_confirmation") || doses.find(d => d.status === "upcoming");
  const box = $("#next-action");
  if (!doses.length) {
    box.replaceChildren(h("p", {}, t("no_doses")), h("button", { class: "btn btn-primary", onclick: () => showView("meds") }, t("add_first")));
  } else if (!next) {
    box.replaceChildren(h("h2", {}, t("all_done")));
  } else {
    const label = next.status === "due" ? "next_due" : next.status === "pending_confirmation" ? "next_confirm" : "next_upcoming";
    box.replaceChildren(
      h("div", { class: "eyebrow" }, t(label)),
      h("h2", {}, `${next.scheduled_time} · ${next.name}`),
      h("p", {}, next.dose),
      next.status !== "upcoming" ? h("div", { class: "dose-actions", style: "margin-top:.75rem" },
        h("button", { class: "btn btn-primary", onclick: () => setDose(next.id, "taken") }, t("btn_taken"))) : null
    );
  }

  $("#dose-list").replaceChildren(...doses.map(doseCard));
  if (!doses.length) $("#dose-list").replaceChildren(emptyState(t("no_doses"), t("add_first"), () => showView("meds")));
}

/** Builds one dose card with its status badge and action buttons. */
function doseCard(d) {
  const final = ["taken", "missed", "skipped"].includes(d.status);
  const buttons = final
    ? [h("button", { class: "btn btn-quiet", onclick: () => setDose(d.id, "scheduled") }, t("btn_undo"))]
    : [h("button", { class: "btn btn-primary", onclick: () => setDose(d.id, "taken") }, t("btn_taken")),
       h("button", { class: "btn btn-quiet", onclick: () => setDose(d.id, "skipped") }, t("btn_skipped")),
       h("button", { class: "btn btn-warn", onclick: () => setDose(d.id, "missed") }, t("btn_missed"))];
  return h("article", { class: `dose dose-${d.status}` },
    h("div", { class: "dose-time" }, d.scheduled_time),
    h("div", {}, h("h3", {}, d.name), h("p", {}, d.dose + (d.notes ? ` · ${d.notes}` : "")), badge(d.status)),
    h("div", { class: "dose-actions" }, buttons));
}

/** Sends the patient's self-reported status to the API and refreshes the list. */
async function setDose(id, status) {
  try {
    await api(`/api/doses/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadToday();
  } catch (e) { toast(e.message, "error"); }
}

/* ===================== MEDICINES ===================== */

/** Fetches all medicines (including inactive) and draws them. */
async function loadMeds() {
  try { state.meds = await api("/api/medications?include_inactive=true"); renderMeds(); }
  catch (e) { toast(e.message, "error"); }
}

/** Draws the medicine list. */
function renderMeds() {
  const list = $("#med-list");
  if (!state.meds.length) { list.replaceChildren(emptyState(t("no_meds"))); return; }
  list.replaceChildren(...state.meds.map(m => h("article", { class: "card" },
    h("h3", {}, m.name), h("p", {}, m.dose),
    h("div", { class: "med-times" }, m.times.map(x => h("span", {}, x))),
    h("p", { class: "hint" }, `${m.start_date}${m.end_date ? " → " + m.end_date : ""}${m.notes ? " · " + m.notes : ""}`),
    m.active ? null : h("span", { class: "badge badge-off" }, t("inactive")),
    h("div", { class: "card-actions" },
      h("button", { class: "btn btn-quiet", onclick: () => openForm(m) }, t("edit")),
      h("button", { class: "btn btn-warn", onclick: () => toggleActive(m) }, t(m.active ? "deactivate" : "activate"))))));
}

/** Turns reminders for a medicine off or on. */
async function toggleActive(m) {
  try {
    await api(`/api/medications/${m.id}/${m.active ? "deactivate" : "activate"}`, { method: "POST" });
    await loadMeds();
  } catch (e) { toast(e.message, "error"); }
}

/** Adds one <input type=time> row to the form (with a remove button). */
function addTimeRow(value = "") {
  const input = h("input", { type: "time", value, required: "required", "aria-label": t("med_times") });
  const row = h("div", { class: "time-row" }, input,
    h("button", { type: "button", class: "btn btn-quiet", "aria-label": "Remove", onclick: () => row.remove() }, "✕"));
  $("#times-box").append(row);
}

/** Opens the form empty (add) or filled (edit). */
function openForm(med = null) {
  state.editId = med ? med.id : null;
  $("#form-title").textContent = t(med ? "edit_med" : "add_med");
  $("#f-name").value = med ? med.name : "";
  $("#f-dose").value = med ? med.dose : "";
  $("#f-notes").value = med ? med.notes : "";
  $("#f-start").value = med ? med.start_date : localDate();
  $("#f-end").value = med && med.end_date ? med.end_date : "";
  $("#times-box").replaceChildren();
  (med ? med.times : [""]).forEach(addTimeRow);
  $("#form-error").hidden = true;
  $("#med-form").hidden = false;
  $("#f-name").focus();
}

/** Validates the form in the browser (translated messages), then saves via the API. */
async function saveMed(event) {
  event.preventDefault();
  const times = [...document.querySelectorAll("#times-box input")].map(i => i.value).filter(Boolean);
  const payload = {
    name: $("#f-name").value.trim(), dose: $("#f-dose").value.trim(), notes: $("#f-notes").value.trim(),
    times, start_date: $("#f-start").value, end_date: $("#f-end").value || null,
  };
  const showError = key => { $("#form-error").textContent = t(key); $("#form-error").hidden = false; };
  if (!payload.name || !payload.dose || !payload.start_date || !times.length) return showError("err_required");
  if (payload.end_date && payload.end_date < payload.start_date) return showError("err_end");
  try {
    const url = state.editId ? `/api/medications/${state.editId}` : "/api/medications";
    await api(url, { method: state.editId ? "PUT" : "POST", body: JSON.stringify(payload) });
    $("#med-form").hidden = true;
    toast(t("saved"));
    loadMeds();
  } catch (e) { toast(e.message, "error"); }
}

/* ===================== REPORT ===================== */

/** Fetches the 7-day report. */
async function loadReport() {
  try { state.report = await api(`/api/reports/weekly?day=${localDate()}&now=${encodeURIComponent(localNow())}`); renderReport(); }
  catch (e) { toast(e.message, "error"); }
}

/** Draws the adherence percentage, counts, formula text and a 7-day bar chart. */
function renderReport() {
  const r = state.report, box = $("#report");
  if (!r) return;
  if (!r.total_scheduled) { box.replaceChildren(emptyState(t("rp_none"), t("add_first"), () => showView("meds"))); return; }
  const stat = (key, n) => h("div", { class: "chip" }, h("b", {}, n), h("span", {}, t(key)));
  const max = Math.max(1, ...r.days.map(d => d.counted));
  box.replaceChildren(
    h("div", { class: "card" },
      h("span", { class: "hint" }, t("rp_adherence")),
      h("div", { class: "big" }, r.adherence_percent == null ? "–" : `${r.adherence_percent}%`),
      h("p", { class: "formula" }, t("rp_formula"))),
    h("div", { class: "summary" },
      stat("rp_total", r.total_scheduled), stat("st_taken", r.taken), stat("st_missed", r.missed),
      stat("st_skipped", r.skipped), stat("st_pending_confirmation", r.pending_confirmation)),
    h("div", { class: "card" },
      h("div", { class: "bars" }, r.days.map(d => h("div", { class: "bar", title: `${d.date}: ${d.taken}/${d.counted}`, role: "img", "aria-label": `${d.date}: ${d.taken}/${d.counted}`, style: `height:${(d.counted / max) * 100}%` },
        h("i", { style: `height:${d.counted ? (d.taken / d.counted) * 100 : 0}%` })))),
      h("div", { class: "bar-labels" }, r.days.map(d => h("span", {}, d.date.slice(8))))));
}

/* ===================== ASSISTANT ===================== */

/** Sends the question to /api/chat and shows the reply with a label (demo / AI / safety rule). */
async function sendChat(event) {
  event.preventDefault();
  const input = $("#chat-input"), text = input.value.trim();
  if (!text) return;
  input.value = "";
  const log = $("#chat-log");
  log.append(h("div", { class: "bubble me" }, text));
  try {
    const res = await api("/api/chat", { method: "POST", body: JSON.stringify({ message: text, language: currentLang }) });
    log.append(h("div", { class: "bubble" }, res.reply, h("small", {}, t(`mode_${res.mode}`))));
  } catch (e) { toast(e.message, "error"); }
  log.scrollTop = log.scrollHeight;
}


/* ===================== PRESCRIPTION SCAN ===================== */
/* Flow: choose photo -> shrink in browser -> /api/ocr/extract -> review cards with confirmation
   questions -> only then POST /api/medications (the same route as manual entry). */

/** Returns date `iso` (YYYY-MM-DD) plus `n` days, as YYYY-MM-DD. */
function addDays(iso, n) {
  const [y, m, d] = iso.split("-").map(Number);
  return localDate(new Date(y, m - 1, d + n));
}

/** Shrinks a photo to max 1600px and converts it to JPEG so it uploads fast and stays under the size limit. */
function shrinkImage(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(b => (b ? resolve(b) : reject(new Error("ocr_bad_image"))), "image/jpeg", 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("ocr_bad_image")); };
    img.src = url;
  });
}

/** Runs when the user picks a photo: uploads it and shows the review cards (or a translated error). */
async function scanPrescription(event) {
  const file = event.target.files[0];
  if (!file) return;
  const status = $("#scan-status"), results = $("#scan-results");
  results.replaceChildren();
  status.textContent = t("scan_reading");
  status.hidden = false;
  try {
    const blob = await shrinkImage(file);
    const form = new FormData();
    form.append("file", blob, "prescription.jpg");
    // Plain fetch (not api()) because api() forces a JSON Content-Type, which breaks file uploads
    const res = await fetch("/api/ocr/extract", { method: "POST", body: form });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof body.detail === "string" ? body.detail : "error_generic");
    status.hidden = true;
    if (!body.medicines.length) { results.replaceChildren(h("p", { class: "warn" }, t("ocr_none"))); }
    else { results.replaceChildren(h("p", { class: "hint" }, t("scan_review_intro")), ...body.medicines.map(scanCard)); }
  } catch (e) {
    status.textContent = t(e.message);   // e.message is an error code such as "ocr_quota"
  }
  event.target.value = "";               // allows choosing the same photo again
}

/** Builds one review card: editable fields + confirmation questions. The Save button stays
    disabled until every required question is answered, so nothing is saved unconfirmed. */
function scanCard(med) {
  const flags = new Set(med.flags);
  const name = h("input", { value: med.name, maxlength: "100" });
  const dose = h("input", { value: med.dose, maxlength: "100" });
  const notes = h("input", { value: med.instructions || "", maxlength: "300" });
  const end = h("input", { type: "date", value: med.duration_days ? addDays(localDate(), med.duration_days - 1) : "" });
  const timesBox = h("div", { class: "times" });

  /** Adds one reminder-time row (with remove button) and re-checks the Save button. */
  const addTime = (value = "") => {
    const input = h("input", { type: "time", value, "aria-label": t("med_times") });
    input.addEventListener("input", refresh);
    const row = h("div", { class: "time-row" }, input,
      h("button", { type: "button", class: "btn btn-quiet", "aria-label": "Remove", onclick: () => { row.remove(); refresh(); } }, "✕"));
    timesBox.append(row);
  };

  /** Creates one "I confirm" checkbox row. */
  const makeCheck = key => {
    const box = h("input", { type: "checkbox" });
    box.addEventListener("change", refresh);
    return { box, row: h("label", { class: "check" }, box, h("span", {}, t(key))) };
  };
  const cName = makeCheck("ocr_c_name"), cDose = makeCheck("ocr_c_dose"), cTimes = makeCheck("ocr_c_times");

  // Extra required question only when the AI guessed an active ingredient (e.g. Panadol -> paracetamol)
  let guess = null, guessRow = null;
  if (med.possible_generic) {
    guess = h("select", {}, h("option", { value: "" }, t("ocr_choose")), h("option", { value: "add" }, t("ocr_g_add")),
      h("option", { value: "no" }, t("ocr_g_no")), h("option", { value: "unsure" }, t("ocr_g_unsure")));
    guess.addEventListener("change", refresh);
    guessRow = h("label", {}, h("span", {}, t("ocr_g_q").replace("{brand}", med.name).replace("{generic}", med.possible_generic)), guess);
  }

  const saveBtn = h("button", { type: "button", class: "btn btn-primary", disabled: "disabled", onclick: save }, t("ocr_confirm_save"));
  const card = h("article", { class: "scan-card" },
    flags.has("low_legibility") ? h("p", { class: "warn" }, t("ocr_w_legibility")) : null,
    flags.has("no_dose") ? h("p", { class: "warn" }, t("ocr_w_nodose")) : null,
    flags.has("no_times") ? h("p", { class: "warn" }, t("ocr_w_notimes")) : null,
    h("label", {}, h("span", {}, t("med_name")), name),
    h("label", {}, h("span", {}, t("med_dose")), dose),
    h("fieldset", {}, h("legend", {}, t("med_times")),
      med.frequency_text ? h("p", { class: "hint" }, t("ocr_schedule_from").replace("{f}", med.frequency_text)) : null,
      flags.has("times_suggested") ? h("p", { class: "hint" }, t("ocr_times_hint")) : null,
      timesBox,
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => addTime() }, t("add_time"))),
    h("div", { class: "row" },
      h("label", {}, h("span", {}, t("med_end")), end),
      h("label", {}, h("span", {}, t("med_notes")), notes)),
    h("div", { class: "questions" }, cName.row, cDose.row, cTimes.row, guessRow),
    h("div", { class: "row actions" }, saveBtn,
      h("button", { type: "button", class: "btn btn-quiet", onclick: () => card.remove() }, t("ocr_discard"))));

  (med.times.length ? med.times : [""]).forEach(addTime);

  /** Enables Save only when name, dose and a time exist AND all confirmations are ticked. */
  function refresh() {
    const hasTime = [...timesBox.querySelectorAll("input")].some(i => i.value);
    const ok = name.value.trim() && dose.value.trim() && hasTime &&
      cName.box.checked && cDose.box.checked && cTimes.box.checked && (!guess || guess.value);
    saveBtn.disabled = !ok;
  }
  [name, dose].forEach(el => el.addEventListener("input", refresh));

  /** Saves the CONFIRMED medicine through the normal medicines API. */
  async function save() {
    const times = [...timesBox.querySelectorAll("input")].map(i => i.value).filter(Boolean);
    let note = notes.value.trim();
    if (guess && guess.value === "add") {
      note = (note ? note + " · " : "") + t("ocr_unverified").replace("{generic}", med.possible_generic);
    }
    const start = localDate();
    if (end.value && end.value < start) { toast(t("err_end"), "error"); return; }
    const payload = { name: name.value.trim(), dose: dose.value.trim(), notes: note.slice(0, 300),
      times, start_date: start, end_date: end.value || null };
    try {
      await api("/api/medications", { method: "POST", body: JSON.stringify(payload) });
      card.remove();
      toast(t("saved"));
      loadMeds();
    } catch (e) { toast(e.message, "error"); }
  }
  return card;
}



/* ===================== Start-up ===================== */

/** Connects buttons and forms to their functions, then loads the first screen. */
function init() {
  document.querySelectorAll(".nav-btn").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
  $("#lang-select").addEventListener("change", e => setLang(e.target.value));
  $("#btn-add-med").addEventListener("click", () => openForm());
  $("#btn-cancel").addEventListener("click", () => { $("#med-form").hidden = true; });
  $("#btn-add-time").addEventListener("click", () => addTimeRow());
  $("#med-form").addEventListener("submit", saveMed);
  $("#chat-form").addEventListener("submit", sendChat);
  $("#btn-notify").addEventListener("click", () => Reminders.enable());
    $("#btn-scan").addEventListener("click", () => { $("#scan-panel").hidden = false; });
  $("#btn-scan-close").addEventListener("click", () => { $("#scan-panel").hidden = true; $("#scan-results").replaceChildren(); $("#scan-status").hidden = true; });
  $("#scan-input").addEventListener("change", scanPrescription);

  setLang(currentLang);
  Reminders.updateButton();
  showView("today");

  setInterval(() => Reminders.check(state.doses), 30000);                    // check reminder times every 30 s
  setInterval(() => { if (state.view === "today") loadToday(); }, 60000);    // refresh statuses every minute
}
document.addEventListener("DOMContentLoaded", init);