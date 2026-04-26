import { gestorIsoRequest } from "./gestorIsoClient.js";

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

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
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

function getProjectTitle(project) {
  return firstValue(
    project.title,
    project.name,
    project.project_name,
    project.projectName,
    project.nombre,
    project.activity_name,
    project.activityName
  ) || "Sin nombre de proyecto";
}

function getProjectClient(project) {
  return firstValue(
    project.client_name,
    project.clientName,
    project.client?.name,
    project.client,
    project.company_name,
    project.customer_name
  ) || "Sin cliente";
}

function getProjectCode(project) {
  return firstValue(
    project.code,
    project.codigo,
    project.project_code,
    project.projectCode
  ) || "";
}

function getProjectDescription(project) {
  return firstValue(
    project.description,
    project.descripcion,
    project.summary,
    project.resumen,
    project.objective,
    project.objetivo,
    project.scope,
    project.alcance
  ) || "Sin descripción registrada.";
}

function getProjectStatusRaw(project) {
  return String(firstValue(
    project.status,
    project.estado,
    project.state,
    project.project_status,
    project.projectStatus
  ) || "active").toLowerCase();
}

function getProjectStatusLabel(project) {
  const raw = normalizeText(getProjectStatusRaw(project));

  const map = {
    active: "Activo",
    activo: "Activo",
    in_progress: "En curso",
    "in progress": "En curso",
    en_curso: "En curso",
    "en curso": "En curso",
    in_review: "En revisión",
    "in review": "En revisión",
    en_revision: "En revisión",
    "en revision": "En revisión",
    "en revisión": "En revisión",
    review: "En revisión",
    revision: "En revisión",
    completed: "Completado",
    completado: "Completado",
    finalizado: "Completado",
    done: "Completado",
    draft: "Borrador",
    borrador: "Borrador",
    on_hold: "En espera",
    "en espera": "En espera",
    paused: "En pausa",
    pausado: "En pausa",
    cancelled: "Cancelado",
    cancelado: "Cancelado"
  };

  return map[raw] || firstValue(project.estado, project.status, "Activo");
}

function getProjectPhase(project) {
  return firstValue(
    project.current_phase,
    project.currentPhase,
    project.phase,
    project.fase,
    project.fase_actual,
    project.stage,
    project.etapa
  ) || "Sin fase informada";
}

function getProjectResponsible(project) {
  return firstValue(
    project.responsible,
    project.responsable,
    project.owner,
    project.manager,
    project.assignee,
    project.assigned_to,
    project.assignedTo
  ) || "Sin responsable";
}

function getProjectProgress(project) {
  const raw = firstValue(
    project.progress,
    project.avance,
    project.percent,
    project.percentage,
    project.completion,
    project.progress_percent,
    project.progressPercent
  );

  if (raw === undefined || raw === null || raw === "") return "sin avance";

  const n = Number(raw);
  if (Number.isFinite(n)) {
    if (n <= 1) return `${Math.round(n * 100)}%`;
    return `${Math.round(n)}%`;
  }

  return String(raw);
}

function getProjectStartDate(project) {
  return firstValue(
    project.start_date,
    project.startDate,
    project.inicio,
    project.fecha_inicio,
    project.created_at
  );
}

function getProjectTargetDate(project) {
  return firstValue(
    project.target_date,
    project.targetDate,
    project.objective_date,
    project.objectiveDate,
    project.end_date,
    project.endDate,
    project.fecha_objetivo,
    project.due_date,
    project.deadline
  );
}

function parseDateValue(value) {
  if (!value) return null;

  const raw = String(value).trim();

  const chileMatch = raw.match(/^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
  if (chileMatch) {
    const [, dd, mm, yyyy, hh = "00", min = "00"] = chileMatch;
    const iso = `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
    const time = Date.parse(iso);
    return Number.isNaN(time) ? null : time;
  }

  const time = Date.parse(raw);
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

function sortByTargetDateAscNoDateLast(a, b) {
  const da = parseDateValue(getProjectTargetDate(a));
  const db = parseDateValue(getProjectTargetDate(b));

  if (da && db) return da - db;
  if (da && !db) return -1;
  if (!da && db) return 1;
  return 0;
}

function extractProjects(response) {
  const candidates = [
    response?.data?.ganttProjects,
    response?.data?.gantt_projects,
    response?.data?.projects,
    response?.ganttProjects,
    response?.gantt_projects,
    response?.projects,
    response?.workspace?.ganttProjects,
    response?.workspace?.projects,
    response?.data?.items,
    response?.items,
    response?.rows,
    response?.data
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

async function fetchProjectsFromGestor() {
  const endpoints = [
    "/api/projects?limit=300"
  ];

  const errors = [];

  for (const endpoint of endpoints) {
    try {
      const response = await gestorIsoRequest(endpoint);
      const projects = extractProjects(response);

      if (projects.length) {
        return {
          endpoint,
          projects
        };
      }
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }

  return {
    endpoint: null,
    projects: [],
    errors
  };
}

function isActiveProject(project) {
  const status = normalizeText(getProjectStatusRaw(project));
  const inactive = ["completado", "completed", "finalizado", "cancelado", "cancelled", "cerrado", "cerrada"];

  return !inactive.some((word) => status.includes(word));
}

function matchesQuery(project, query) {
  const q = normalizeText(query);
  const qc = compactText(query);

  const values = [
    getProjectTitle(project),
    getProjectClient(project),
    getProjectCode(project),
    getProjectDescription(project),
    getProjectStatusLabel(project),
    getProjectPhase(project),
    getProjectResponsible(project)
  ];

  return values.some((value) => {
    const normalized = normalizeText(value);
    const compacted = compactText(value);

    return normalized.includes(q) || compacted.includes(qc);
  });
}

function scoreProject(query, project) {
  const values = [
    getProjectClient(project),
    getProjectTitle(project),
    getProjectCode(project),
    getProjectDescription(project)
  ];

  return Math.max(...values.map((value) => similarity(query, value)));
}

function formatProjectList(projects, { title = "Proyectos", page = 1, limit = 5, query = "" } = {}) {
  const sorted = [...projects].sort(sortByTargetDateAscNoDateLast);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const total = sorted.length;
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (currentPage - 1) * safeLimit;
  const end = start + safeLimit;
  const pageItems = sorted.slice(start, end);

  const lines = pageItems.map((project, index) => {
    const n = start + index + 1;
    const client = getProjectClient(project);
    const projectTitle = getProjectTitle(project);
    const status = getProjectStatusLabel(project);
    const target = formatDate(getProjectTargetDate(project));

    return `${n}. ${projectTitle} — ${client} — ${status} — objetivo ${target}`;
  });

  const nextHint = currentPage < totalPages
    ? `\n\nPara ver más: /proyectos${query ? ` ${query}` : ""} ${currentPage + 1}`
    : "";

  return `${title}\nPágina ${currentPage}/${totalPages} · ${start + 1}-${Math.min(end, total)} de ${total}\n\n${lines.join("\n")}\n\nResponde con el número del proyecto para ver el detalle.${nextHint}`;
}

function formatProjectDetail(project) {
  const title = getProjectTitle(project);
  const client = getProjectClient(project);
  const code = getProjectCode(project);
  const status = getProjectStatusLabel(project);
  const phase = getProjectPhase(project);
  const progress = getProjectProgress(project);
  const start = formatDate(getProjectStartDate(project));
  const target = formatDate(getProjectTargetDate(project));
  const responsible = getProjectResponsible(project);
  const description = getProjectDescription(project);

  return [
    "Proyecto",
    "",
    `Cliente: ${client}`,
    `Nombre: ${title}`,
    code ? `Código: ${code}` : null,
    `Estado: ${status}`,
    `Fase actual: ${phase}`,
    `Avance: ${progress}`,
    `Inicio: ${start}`,
    `Objetivo: ${target}`,
    `Responsable: ${responsible}`,
    "",
    "Descripción:",
    description
  ].filter(Boolean).join("\n");
}

export async function getProjects({
  query = "",
  limit = 5,
  page = 1,
  detail = false,
  includeCompleted = false
} = {}) {
  const cleanQuery = String(query || "").trim();
  const result = await fetchProjectsFromGestor();
  const projects = result.projects || [];

  if (!projects.length) {
    return {
      ok: false,
      intent: "projects",
      source: "gestor_iso",
      text: `No pude obtener proyectos desde Gestor ISO.\n\nEndpoint probado sin resultado.\n${result.errors?.slice(0, 3).join("\n") || ""}`.trim()
    };
  }

  const baseProjects = includeCompleted ? projects : projects.filter(isActiveProject);
  let filtered = baseProjects;

  if (cleanQuery) {
    filtered = baseProjects.filter((project) => matchesQuery(project, cleanQuery));
  }

  if (!filtered.length && cleanQuery) {
    const suggestions = baseProjects
      .map((project) => ({
        project,
        score: scoreProject(cleanQuery, project)
      }))
      .filter((item) => item.score >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (suggestions.length) {
      const lines = suggestions.map((item, index) => {
        const title = getProjectTitle(item.project);
        const client = getProjectClient(item.project);
        const target = formatDate(getProjectTargetDate(item.project));

        return `${index + 1}. ${title} — ${client} — objetivo ${target}`;
      });

      return {
        ok: true,
        intent: "projects",
        source: "gestor_iso",
        text: `No encontré proyectos para “${cleanQuery}” exacto.\n\nPosibles coincidencias:\n${lines.join("\n")}\n\nResponde con el número de la opción para ver el detalle.\nO escribe “no” para cancelar.\n\nPrueba:\n/proyecto ${getProjectTitle(suggestions[0].project)}`
      };
    }
  }

  if (!filtered.length) {
    return {
      ok: false,
      intent: "projects",
      source: "gestor_iso",
      text: cleanQuery
        ? `No encontré proyectos para: ${cleanQuery}`
        : "No encontré Proyectos."
    };
  }

  if (detail || filtered.length === 1) {
    return {
      ok: true,
      intent: "projects",
      source: "gestor_iso",
      text: formatProjectDetail(filtered[0])
    };
  }

  return {
    ok: true,
    intent: "projects",
    source: "gestor_iso",
    text: formatProjectList(filtered, {
      title: cleanQuery ? `Proyectos · ${cleanQuery}` : "Proyectos",
      page,
      limit,
      query: cleanQuery
    })
  };
}



