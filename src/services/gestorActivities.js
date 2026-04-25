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

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value = "") {
  return normalizeText(value).replace(/\s+/g, "");
}

function looseText(value = "") {
  return compactText(value).replace(/v/g, "b");
}

function levenshtein(a = "", b = "") {
  const x = looseText(a);
  const y = looseText(b);

  if (!x && !y) return 0;
  if (!x) return y.length;
  if (!y) return x.length;

  const matrix = Array.from({ length: x.length + 1 }, () =>
    Array(y.length + 1).fill(0)
  );

  for (let i = 0; i <= x.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= y.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[x.length][y.length];
}

function similarity(a = "", b = "") {
  const x = looseText(a);
  const y = looseText(b);

  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.94;

  const distance = levenshtein(x, y);
  const maxLength = Math.max(x.length, y.length);

  return maxLength === 0 ? 0 : 1 - distance / maxLength;
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function getClientName(project) {
  return firstValue(
    project.client_name,
    project.clientName,
    project.client?.name,
    project.client,
    project.company_name
  ) || "Sin cliente";
}

function getActivityTitle(project) {
  return firstValue(
    project.name,
    project.title,
    project.activity_name,
    project.activityName
  ) || "Sin actividad";
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
  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const month = months[date.getUTCMonth()];
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

function exactClientMatch(project, query) {
  const client = getClientName(project);
  const clientNorm = normalizeText(client);
  const queryNorm = normalizeText(query);

  const clientCompact = compactText(client);
  const queryCompact = compactText(query);

  return (
    clientNorm.includes(queryNorm) ||
    clientCompact.includes(queryCompact)
  );
}

function findSimilarClients(query, projects = []) {
  const byClient = new Map();

  for (const project of projects) {
    const name = getClientName(project);
    const key = compactText(name);

    if (!key || name === "Sin cliente") continue;

    const nameParts = normalizeText(name).split(" ").filter(Boolean);
    const candidates = new Set();

    candidates.add(name);
    if (nameParts.length) candidates.add(nameParts[0]);
    if (nameParts.length >= 2) candidates.add(`${nameParts[0]} ${nameParts[1]}`);
    candidates.add(compactText(name));

    const score = Math.max(
      ...[...candidates].map((candidate) => similarity(query, candidate))
    );

    if (score >= 0.50) {
      const current = byClient.get(key);

      if (!current || score > current.score) {
        byClient.set(key, {
          name,
          score
        });
      }
    }
  }

  return [...byClient.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function extractProjects(response) {
  const raw =
    response?.data?.projects ||
    response?.projects ||
    response?.data ||
    response ||
    [];

  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.items)) return raw.items;
  if (Array.isArray(raw.rows)) return raw.rows;

  return [];
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
  const allProjects = extractProjects(response);

  let projects = allProjects;

  if (hasClient) {
    projects = allProjects.filter((project) => exactClientMatch(project, cleanClient));
  }

  if (!projects.length && hasClient) {
    const suggestions = findSimilarClients(cleanClient, allProjects);

    if (suggestions.length === 1) {
      const suggested = suggestions[0].name;
      const statusPart = hasStatus ? ` ${statusLabel(normalizedStatus)}` : "";

      return {
        ok: true,
        intent: "activities_status",
        source: "gestor_iso",
        text: `No encontré actividades para “${cleanClient}”.\n\nPosible coincidencia:\n¿Te refieres a “${suggested}”?\n\nPrueba:\n/actividad ${suggested}${statusPart}`
      };
    }

    if (suggestions.length > 1) {
      const lines = suggestions.map((item, index) => `${index + 1}. ${item.name}`);
      const statusPart = hasStatus ? ` ${statusLabel(normalizedStatus)}` : "";

      return {
        ok: true,
        intent: "activities_status",
        source: "gestor_iso",
        text: `No encontré actividades para “${cleanClient}” exacto.\n\nPosibles coincidencias:\n${lines.join("\n")}\n\nPrueba:\n/actividad ${suggestions[0].name}${statusPart}`
      };
    }
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

  const lines = pageItems.map((project) => {
    const client = getClientName(project);
    const title = getActivityTitle(project);
    const state = statusLabel(project.status || normalizedStatus);
    const date = formatDate(getProjectDate(project));

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
