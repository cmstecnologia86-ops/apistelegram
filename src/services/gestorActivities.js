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

  return labels[status] || status || "sin estado";
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

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export async function getActivitiesByStatus({
  status = "",
  clientName = "",
  limit = 5,
  page = 1
} = {}) {
  const cleanClient = String(clientName || "").trim();
  const hasClient = cleanClient !== "";
  const hasStatus = String(status || "").trim() !== "";
  const normalizedStatus = hasStatus ? normalizeStatus(status) : "";

  const defaultLimit = hasClient ? 10 : 5;
  const safeLimit = Math.min(Math.max(Number(limit) || defaultLimit, 1), 10);
  const safePage = Math.max(Number(page) || 1, 1);

  const params = new URLSearchParams();
  params.set("limit", "100");
  if (hasStatus) params.set("status", normalizedStatus);

  const response = await gestorIsoRequest(`/api/projects?${params.toString()}`);
  let projects = response?.data?.projects || [];

  if (hasClient) {
    const needle = normalizeText(cleanClient);

    projects = projects.filter((p) => {
      const client = firstValue(p.client_name, p.clientName, p.client?.name, p.client, p.company_name) || "";
      return normalizeText(client).includes(needle);
    });
  }

  if (!projects.length) {
    const target = [
      hasStatus ? `estado ${status}` : "",
      hasClient ? `cliente ${cleanClient}` : ""
    ].filter(Boolean).join(" · ");

    return {
      ok: false,
      intent: "activities_status",
      source: "gestor_iso",
      text: `No encontré actividades para ${target || "la búsqueda solicitada"}.`
    };
  }

  const sorted = [...projects].sort(sortByDateAscNoDateLast);
  const total = sorted.length;
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safeLimit;
  const end = start + safeLimit;
  const pageItems = sorted.slice(start, end);

  const lines = pageItems.map((p) => {
    const client = firstValue(p.client_name, p.clientName, p.client?.name, p.client, p.company_name) || "Sin cliente";
    const title = firstValue(p.name, p.title, p.activity_name, p.activityName) || "Sin actividad";
    const state = statusLabel(p.status || normalizedStatus);
    const date = formatDate(getProjectDate(p));

    return `- ${client} — ${title} — ${state} — ${date}`;
  });

  const titleParts = ["Actividades"];
  if (hasStatus) titleParts.push(statusLabel(normalizedStatus));
  if (hasClient) titleParts.push(cleanClient);

  const nextHint = currentPage < totalPages
    ? `\n\nPara ver más: /actividad ${hasClient ? cleanClient : status} ${currentPage + 1}`
    : "";

  return {
    ok: true,
    intent: "activities_status",
    source: "gestor_iso",
    text: `${titleParts.join(" · ")}\nPágina ${currentPage}/${totalPages} · ${start + 1}-${Math.min(end, total)} de ${total}\n\n${lines.join("\n")}${nextHint}`,
    meta: {
      status: hasStatus ? statusLabel(normalizedStatus) : null,
      client_name: hasClient ? cleanClient : null,
      page: currentPage,
      limit: safeLimit,
      total,
      totalPages
    }
  };
}
