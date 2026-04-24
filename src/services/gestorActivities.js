import { gestorIsoRequest } from "./gestorIsoClient.js";

function normalizeStatus(input = "") {
  const raw = String(input || "").trim().toLowerCase();

  const map = {
    "borrador": "draft",
    "draft": "draft",

    "en curso": "in_progress",
    "curso": "in_progress",
    "in_progress": "in_progress",
    "in progress": "in_progress",

    "en revision": "in_review",
    "en revisión": "in_review",
    "revision": "in_review",
    "revisión": "in_review",
    "in_review": "in_review",

    "en espera": "on_hold",
    "espera": "on_hold",
    "on_hold": "on_hold",

    "completado": "completed",
    "completada": "completed",
    "completadas": "completed",
    "completados": "completed",
    "completed": "completed",

    "cancelado": "cancelled",
    "cancelada": "cancelled",
    "cancelled": "cancelled"
  };

  return map[raw] || raw;
}

function statusLabel(status) {
  const labels = {
    draft: "borrador",
    in_progress: "en curso",
    in_review: "en revisión",
    on_hold: "en espera",
    completed: "completado",
    cancelled: "cancelado"
  };

  return labels[status] || status;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function getProjectDate(project) {
  return firstValue(
    project.due_date,
    project.dueDate,
    project.deadline,
    project.end_date,
    project.endDate,
    project.date,
    project.fecha,
    project.fecha_compromiso,
    project.planned_date,
    project.next_action_date,
    project.start_date,
    project.startDate
  );
}

function parseDateValue(value) {
  if (!value) return null;
  const time = Date.parse(String(value));
  return Number.isNaN(time) ? null : time;
}

function formatDate(value) {
  const time = parseDateValue(value);
  if (!time) return "sin fecha";

  const date = new Date(time);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();

  return `${day}-${month}-${year}`;
}

function sortByDateAscNoDateLast(a, b) {
  const da = parseDateValue(getProjectDate(a));
  const db = parseDateValue(getProjectDate(b));

  if (da && db) return da - db;
  if (da && !db) return -1;
  if (!da && db) return 1;
  return 0;
}

export async function getActivitiesByStatus({ status = "en curso", limit = 20 } = {}) {
  const normalizedStatus = normalizeStatus(status);

  const params = new URLSearchParams();
  params.set("status", normalizedStatus);
  params.set("limit", String(Math.max(Number(limit) || 20, 100)));

  const response = await gestorIsoRequest(`/api/projects?${params.toString()}`);
  const projects = response?.data?.projects || [];

  if (!projects.length) {
    return {
      ok: false,
      intent: "activities_status",
      source: "gestor_iso",
      text: `No encontré actividades en estado ${status}.`
    };
  }

  const sorted = [...projects]
    .sort(sortByDateAscNoDateLast)
    .slice(0, Number(limit) || 20);

  const lines = sorted.map((p) => {
    const client = firstValue(p.client_name, p.clientName, p.client?.name, p.client, p.company_name) || "Sin cliente";
    const title = firstValue(p.name, p.title, p.activity_name, p.activityName) || "Sin actividad";
    const date = formatDate(getProjectDate(p));

    return `- ${client} — ${title} — ${date}`;
  });

  return {
    ok: true,
    intent: "activities_status",
    source: "gestor_iso",
    text: `Actividades ${statusLabel(normalizedStatus)}\n\n${lines.join("\n")}`
  };
}
