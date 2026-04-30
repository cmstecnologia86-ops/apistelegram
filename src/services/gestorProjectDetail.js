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

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
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

function statusLabel(value = "") {
  const raw = normalizeText(value);

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
    pending: "Pendiente",
    pendiente: "Pendiente",
    completed: "Completado",
    completado: "Completado",
    finalizado: "Completado",
    blocked: "Bloqueada",
    bloqueado: "Bloqueada",
    bloqueada: "Bloqueada",
    cancelled: "Cancelado",
    cancelado: "Cancelado"
  };

  return map[raw] || value || "Sin estado";
}

function progressLabel(value) {
  if (value === undefined || value === null || value === "") return "sin avance";

  const n = Number(value);
  if (Number.isFinite(n)) {
    if (n <= 1) return `${Math.round(n * 100)}%`;
    return `${Math.round(n)}%`;
  }

  return String(value);
}

function getProjectTitle(project) {
  return firstValue(
    project.title,
    project.name,
    project.project_name,
    project.projectName,
    project.nombre
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

function getProjectStatus(project) {
  return statusLabel(firstValue(project.status, project.estado, project.state, project.project_status, project.projectStatus));
}

function getProjectPriority(project) {
  const rawValue = firstValue(project.priority, project.prioridad, project.priority_label, project.priorityLabel);
  const raw = normalizeText(rawValue || "");

  const map = {
    high: "Alta",
    alta: "Alta",
    medium: "Media",
    media: "Media",
    low: "Baja",
    baja: "Baja",
    urgent: "Urgente",
    urgente: "Urgente",
    critical: "Crítica",
    critica: "Crítica",
    "crítica": "Crítica"
  };

  return map[raw] || rawValue || "Sin prioridad";
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

function getProjectProgress(project) {
  return progressLabel(firstValue(
    project.progress,
    project.avance,
    project.percent,
    project.percentage,
    project.completion,
    project.progress_percent,
    project.progressPercent
  ));
}

function getProjectStartDate(project) {
  return firstValue(project.start_date, project.startDate, project.inicio, project.fecha_inicio, project.created_at);
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

function getProjectResponsible(project) {
  return firstValue(
    project.responsible_name,
    project.responsibleName,
    project.owner_name,
    project.ownerName,
    project.responsible,
    project.responsable,
    project.owner,
    project.manager,
    project.assignee,
    project.assigned_to,
    project.assignedTo
  ) || "Sin responsable";
}

function getStageTitle(stage) {
  return firstValue(stage.title, stage.name, stage.stage_name, stage.stageName, stage.nombre, stage.phase, stage.fase) || "Sin nombre de etapa";
}

function getStageDescription(stage) {
  return firstValue(stage.description, stage.descripcion, stage.objective, stage.objetivo, stage.summary, stage.resumen) || "";
}

function getStageNote(stage) {
  return firstValue(stage.note, stage.notes, stage.nota, stage.notas, stage.observation, stage.observations) || "";
}

function getStageStatus(stage) {
  return statusLabel(firstValue(stage.status, stage.estado, stage.state));
}

function getStageProgress(stage) {
  return progressLabel(firstValue(
    stage.progress_percent,
    stage.progressPercent,
    stage.progress,
    stage.avance,
    stage.percent,
    stage.percentage,
    stage.completion
  ));
}

function getStageStart(stage) {
  return firstValue(stage.start_date, stage.startDate, stage.inicio, stage.fecha_inicio);
}

function getStageEnd(stage) {
  return firstValue(stage.end_date, stage.endDate, stage.termino, stage.término, stage.fecha_termino, stage.deadline, stage.due_date);
}

function getStageResponsible(stage, project = {}) {
  return firstValue(
    stage.responsible_name,
    stage.responsibleName,
    stage.owner_name,
    stage.ownerName,
    stage.responsible_email,
    stage.responsibleEmail,
    stage.responsible,
    stage.responsable,
    stage.owner,
    stage.manager,
    stage.assignee,
    stage.assigned_to,
    stage.assignedTo
  ) || getProjectResponsible(project);
}

function extractStages(project) {
  const candidates = [
    project.stages,
    project.etapas,
    project.tasks,
    project.gantt_tasks,
    project.ganttTasks,
    project.phases,
    project.fases,
    project.timeline,
    project.gantt_stages,
    project.ganttStages,
    project.project_stages,
    project.projectStages
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

function extractChecklist(stage) {
  const candidates = [
    stage.checklist,
    stage.results,
    stage.resultados,
    stage.tasks,
    stage.items,
    stage.deliverables,
    stage.entregables
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

function getChecklistText(item) {
  if (typeof item === "string") return item;

  return firstValue(
    item.title,
    item.name,
    item.text,
    item.description,
    item.descripcion,
    item.result,
    item.resultado
  ) || "Resultado sin nombre";
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

async function fetchProjects() {
  const endpoints = ["/api/gantt-projects"];

  const errors = [];

  for (const endpoint of endpoints) {
    try {
      const response = await gestorIsoRequest(endpoint);
      const projects = extractProjects(response);

      if (projects.length) {
        return { endpoint, projects };
      }
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }

  return { endpoint: null, projects: [], errors };
}

async function fetchProjectById(id) {
  const endpoints = [`/api/gantt-projects/${encodeURIComponent(id)}`];

  for (const endpoint of endpoints) {
    try {
      const response = await gestorIsoRequest(endpoint);
      const raw = response?.data || response?.project || response;
      const project = raw?.project && typeof raw.project === "object" ? { ...raw.project, tasks: raw.tasks || raw.project.tasks || [] } : raw;

      if (project && typeof project === "object" && !Array.isArray(project)) {
        return project;
      }
    } catch {
      // sigue probando endpoints
    }
  }

  return null;
}

function projectMatches(project, query) {
  const q = normalizeText(query);
  const qc = compactText(query);

  const values = [
    getProjectTitle(project),
    getProjectClient(project),
    getProjectCode(project),
    getProjectDescription(project)
  ];

  return values.some((value) => {
    const normalized = normalizeText(value);
    const compacted = compactText(value);

    return normalized.includes(q) || compacted.includes(qc);
  });
}

function projectId(project) {
  return firstValue(project.id, project.project_id, project.projectId, project.uuid, project.slug);
}

async function resolveProject(query) {
  const cleanQuery = String(query || "").trim();
  const result = await fetchProjects();

  if (!result.projects.length) {
    return {
      project: null,
      projects: [],
      error: `No pude obtener proyectos desde Gestor ISO.\n${result.errors?.slice(0, 3).join("\n") || ""}`.trim()
    };
  }

  const matches = cleanQuery
    ? result.projects.filter((project) => projectMatches(project, cleanQuery))
    : result.projects;

  const selected = matches[0];

  if (!selected) {
    return {
      project: null,
      projects: result.projects,
      error: `No encontré proyecto para: ${cleanQuery}`
    };
  }

  const id = projectId(selected);
  const detailed = id ? await fetchProjectById(id) : null;

  return {
    project: detailed || selected,
    projects: result.projects,
    error: null
  };
}

function findNextStage(stages) {
  return stages.find((stage) => {
    const status = normalizeText(getStageStatus(stage));
    return status.includes("pendiente") || status.includes("siguiente") || status.includes("en espera");
  }) || stages.find((stage) => {
    const status = normalizeText(getStageStatus(stage));
    return !status.includes("completado") && !status.includes("bloquead");
  }) || null;
}

function formatProjectExecutive(project) {
  const stages = extractStages(project);
  const nextStage = findNextStage(stages);

  const header = [
    `Proyecto · ${getProjectClient(project)}`,
    "",
    `Nombre: ${getProjectTitle(project)}`,
    getProjectCode(project) ? `Código: ${getProjectCode(project)}` : null,
    `Estado: ${getProjectStatus(project)}`,
    `Prioridad: ${getProjectPriority(project)}`,
    `Fase actual: ${getProjectPhase(project)}`,
    `Avance general: ${getProjectProgress(project)}`,
    `Inicio: ${formatDate(getProjectStartDate(project))}`,
    `Objetivo: ${formatDate(getProjectTargetDate(project))}`,
    `Responsable: ${getProjectResponsible(project)}`,
    "",
    "Descripción:",
    getProjectDescription(project)
  ].filter(Boolean);

  if (nextStage) {
    header.push(
      "",
      "Próxima etapa:",
      `${getStageTitle(nextStage)} — ${getStageStatus(nextStage)} — ${getStageProgress(nextStage)}`
    );
  }

  if (stages.length) {
    header.push("", "Etapas:");

    stages.forEach((stage, index) => {
      header.push(`${index + 1}. ${getStageTitle(stage)} — ${getStageStatus(stage)} — ${getStageProgress(stage)}`);
    });

    header.push("", "Opciones:");

    stages.forEach((stage, index) => {
      const projectRef = getProjectCode(project) || getProjectTitle(project); header.push(`${index + 1}. /proyecto_etapa ${projectRef} | ${index + 1}`);
    });

    header.push("", "Responde con el número de la etapa para ver el detalle.");
  } else {
    header.push("", "Etapas: sin etapas registradas o no incluidas por el endpoint.");
  }

  return header.join("\n");
}

function formatStageDetail(project, stageNumber = 1) {
  const stages = extractStages(project);
  const index = Math.max(Number(stageNumber) || 1, 1) - 1;
  const stage = stages[index];

  if (!stage) {
    return `No encontré la etapa ${stageNumber} para este proyecto.`;
  }

  const checklist = extractChecklist(stage);

  const lines = [
    `Etapa #${index + 1} · ${getStageTitle(stage)}`,
    "",
    `Proyecto: ${getProjectTitle(project)}`,
    `Cliente: ${getProjectClient(project)}`,
    `Estado: ${getStageStatus(stage)}`,
    `Avance: ${getStageProgress(stage)}`,
    `Inicio: ${formatDate(getStageStart(stage))}`,
    `Término: ${formatDate(getStageEnd(stage))}`,
    `Responsable: ${getStageResponsible(stage, project)}`
  ];

  const description = getStageDescription(stage);
  const note = getStageNote(stage);

  if (description) {
    lines.push("", "Objetivo:", description);
  }

  if (note) {
    lines.push("", "Nota:", note);
  }

  if (checklist.length) {
    lines.push("", "Checklist:");
    checklist.forEach((item, itemIndex) => {
      lines.push(`${itemIndex + 1}. ${getChecklistText(item)}`);
    });
  } else {
    lines.push("", "Checklist: sin resultados registrados.");
  }

  const projectRef = getProjectCode(project) || getProjectTitle(project);

  lines.push(
    "",
    "Opciones:",
    `1. /proyecto_detalle ${projectRef}`,
    "",
    "Responde 1 para volver al proyecto."
  );

  return lines.join("\n");
}

export async function getProjectDetail({
  query = "",
  stage = null
} = {}) {
  const cleanQuery = String(query || "").trim();

  if (!cleanQuery) {
    return {
      ok: false,
      intent: "project_detail",
      source: "gestor_iso",
      text: "Debes indicar el proyecto. Ejemplo: /proyecto Rivas"
    };
  }

  const result = await resolveProject(cleanQuery);

  if (!result.project) {
    return {
      ok: false,
      intent: "project_detail",
      source: "gestor_iso",
      text: result.error || `No encontré proyecto para: ${cleanQuery}`
    };
  }

  return {
    ok: true,
    intent: "project_detail",
    source: "gestor_iso",
    text: stage ? formatStageDetail(result.project, stage) : formatProjectExecutive(result.project)
  };
}







