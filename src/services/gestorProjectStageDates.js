import { gestorIsoRequest } from "./gestorIsoClient.js";

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }

  return null;
}

function formatDate(value) {
  if (!value) return "sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  }).replace(".", "");
}

function parseDateInput(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;

  const raw = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return null;
  }

  const date = new Date(`${raw}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) return null;

  return raw;
}

function projectId(project = {}) {
  return firstValue(project.id, project.project_id, project.projectId, project.uuid);
}

function getProjectTitle(project = {}) {
  return firstValue(project.title, project.name, project.project_name, project.projectName, project.nombre) || "Sin nombre";
}

function getProjectCode(project = {}) {
  return firstValue(project.code, project.codigo, project.project_code, project.projectCode, project.short_code, project.shortCode);
}

function getProjectClient(project = {}) {
  const client = firstValue(
    project.client_name,
    project.clientName,
    project.cliente,
    project.client,
    project.customer_name,
    project.customerName
  );

  if (client && typeof client === "object") {
    return firstValue(client.name, client.nombre, client.razon_social, client.razonSocial) || "Sin cliente";
  }

  return client || "Sin cliente";
}

function getStageTitle(stage = {}) {
  return firstValue(stage.title, stage.name, stage.stage_name, stage.stageName, stage.nombre, stage.phase, stage.fase) || "Sin nombre de etapa";
}

function getStageId(stage = {}) {
  return firstValue(stage.id, stage.task_id, stage.taskId, stage.uuid);
}

function getStageStart(stage = {}) {
  return firstValue(stage.start_date, stage.startDate, stage.inicio, stage.fecha_inicio);
}

function getStageEnd(stage = {}) {
  return firstValue(stage.end_date, stage.endDate, stage.termino, stage.término, stage.fecha_termino, stage.deadline, stage.due_date);
}

function extractProjects(response) {
  const candidates = [
    response?.data?.projects,
    response?.data,
    response?.projects,
    response?.items,
    response?.results,
    response
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

function extractStages(project = {}) {
  const candidates = [
    project.tasks,
    project.stages,
    project.etapas,
    project.gantt_tasks,
    project.ganttTasks,
    project.project_stages,
    project.projectStages
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

async function fetchProjects() {
  const response = await gestorIsoRequest("/api/gantt-projects");
  return extractProjects(response);
}

async function fetchProjectById(id) {
  const response = await gestorIsoRequest(`/api/gantt-projects/${encodeURIComponent(id)}`);
  const raw = response?.data || response?.project || response;

  if (raw?.project && typeof raw.project === "object") {
    return {
      ...raw.project,
      tasks: raw.tasks || raw.project.tasks || []
    };
  }

  return raw;
}

async function resolveProject(query) {
  const cleanQuery = String(query || "").trim();

  if (!cleanQuery) return null;

  const projects = await fetchProjects();
  const normalizedQuery = normalizeText(cleanQuery);

  let project = projects.find((item) => {
    const code = normalizeText(getProjectCode(item));
    return code && code === normalizedQuery;
  });

  if (project) {
    const id = projectId(project);
    return id ? fetchProjectById(id) : project;
  }

  project = projects.find((item) => {
    const title = normalizeText(getProjectTitle(item));
    const client = normalizeText(getProjectClient(item));
    return title.includes(normalizedQuery) || client.includes(normalizedQuery);
  });

  if (!project) return null;

  const id = projectId(project);
  return id ? fetchProjectById(id) : project;
}

function getStageByNumber(project, stageNumber) {
  const stages = extractStages(project);
  const index = Number(stageNumber) - 1;

  if (!Number.isInteger(index) || index < 0 || index >= stages.length) {
    return { stage: null, stages };
  }

  return { stage: stages[index], stages };
}

function formatDateOptions(project, stage, stageNumber) {
  const projectRef = getProjectCode(project) || getProjectTitle(project);

  return [
    `Editar fechas · Etapa #${stageNumber}`,
    "",
    `Proyecto: ${getProjectClient(project)}`,
    `Etapa: ${getStageTitle(stage)}`,
    `Inicio actual: ${formatDate(getStageStart(stage))}`,
    `Término actual: ${formatDate(getStageEnd(stage))}`,
    "",
    "Para cambiar fechas, usa formato AAAA-MM-DD.",
    "",
    "Ejemplos:",
    `Cambiar inicio — /proyecto_fechas ${projectRef} | ${stageNumber} | inicio 2026-05-10`,
    `Cambiar término — /proyecto_fechas ${projectRef} | ${stageNumber} | termino 2026-05-20`,
    `Cambiar ambas fechas — /proyecto_fechas ${projectRef} | ${stageNumber} | 2026-05-10 | 2026-05-20`,
    "",
    "Opciones:",
    `1. Volver — /proyecto_etapa ${projectRef} | ${stageNumber}`,
    "",
    "Responde 1 para volver."
  ].join("\n");
}

function formatConfirm(project, stage, stageNumber, nextStartDate, nextEndDate) {
  const projectRef = getProjectCode(project) || getProjectTitle(project);
  const startText = nextStartDate ? formatDate(nextStartDate) : "sin cambio";
  const endText = nextEndDate ? formatDate(nextEndDate) : "sin cambio";
  const startCommand = nextStartDate || "-";
  const endCommand = nextEndDate || "-";

  return [
    "Confirmar cambio de fechas",
    "",
    `Proyecto: ${getProjectClient(project)}`,
    `Etapa: ${getStageTitle(stage)}`,
    `Inicio actual: ${formatDate(getStageStart(stage))}`,
    `Término actual: ${formatDate(getStageEnd(stage))}`,
    "",
    `Nuevo inicio: ${startText}`,
    `Nuevo término: ${endText}`,
    "",
    "Opciones:",
    `1. Confirmar cambio — /proyecto_fechas_aplicar ${projectRef} | ${stageNumber} | ${startCommand} | ${endCommand}`,
    `2. Cancelar y volver — /proyecto_etapa ${projectRef} | ${stageNumber}`,
    "",
    "Responde 1 para confirmar o 2 para cancelar."
  ].join("\n");
}

function normalizeDateArgs({ startDate, endDate, rawDateText }) {
  let nextStartDate = parseDateInput(startDate);
  let nextEndDate = parseDateInput(endDate);

  const raw = String(rawDateText || "").trim();

  if (raw && (!nextStartDate && !nextEndDate)) {
    const parts = raw.split("|").map((item) => item.trim()).filter(Boolean);

    if (parts.length === 1) {
      const value = parts[0];

      if (/^inicio\s+/i.test(value)) {
        nextStartDate = parseDateInput(value.replace(/^inicio\s+/i, ""));
      } else if (/^(termino|término|fin)\s+/i.test(value)) {
        nextEndDate = parseDateInput(value.replace(/^(termino|término|fin)\s+/i, ""));
      }
    }

    if (parts.length >= 2) {
      nextStartDate = parseDateInput(parts[0]);
      nextEndDate = parseDateInput(parts[1]);
    }
  }

  if (String(startDate || "").trim() === "-") nextStartDate = null;
  if (String(endDate || "").trim() === "-") nextEndDate = null;

  return { nextStartDate, nextEndDate };
}

export async function getProjectStageDates({
  query = "",
  stage = null,
  startDate = "",
  endDate = "",
  rawDateText = "",
  confirm = false
} = {}) {
  const cleanQuery = String(query || "").trim();
  const stageNumber = Number(stage || 0);

  if (!cleanQuery || !stageNumber) {
    return {
      ok: false,
      intent: "project_stage_dates",
      source: "gestor_iso",
      text: "Debes indicar proyecto y etapa. Ejemplo: /proyecto_fechas RIVAS-ISO-HACCP-2026 | 1"
    };
  }

  const project = await resolveProject(cleanQuery);

  if (!project) {
    return {
      ok: false,
      intent: "project_stage_dates",
      source: "gestor_iso",
      text: `No encontré proyecto para: ${cleanQuery}`
    };
  }

  const { stage: selectedStage } = getStageByNumber(project, stageNumber);

  if (!selectedStage) {
    return {
      ok: false,
      intent: "project_stage_dates",
      source: "gestor_iso",
      text: `No encontré la etapa ${stageNumber} para este proyecto.`
    };
  }

  const { nextStartDate, nextEndDate } = normalizeDateArgs({ startDate, endDate, rawDateText });

  if (!nextStartDate && !nextEndDate) {
    return {
      ok: true,
      intent: "project_stage_dates",
      source: "gestor_iso",
      text: formatDateOptions(project, selectedStage, stageNumber)
    };
  }

  if (!confirm) {
    return {
      ok: true,
      intent: "project_stage_dates_confirm",
      source: "gestor_iso",
      text: formatConfirm(project, selectedStage, stageNumber, nextStartDate, nextEndDate)
    };
  }

  const id = projectId(project);
  const taskId = getStageId(selectedStage);

  if (!id || !taskId) {
    return {
      ok: false,
      intent: "project_stage_dates_apply",
      source: "gestor_iso",
      text: "No pude identificar el ID interno del proyecto o de la etapa."
    };
  }

  const updateBody = {};

  if (nextStartDate) updateBody.start_date = nextStartDate;
  if (nextEndDate) updateBody.end_date = nextEndDate;

  await gestorIsoRequest(`/api/gantt-projects/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: updateBody
  });

  const updatedProject = await fetchProjectById(id);
  const { stage: updatedStage } = getStageByNumber(updatedProject, stageNumber);
  const projectRef = getProjectCode(updatedProject) || getProjectTitle(updatedProject);

  return {
    ok: true,
    intent: "project_stage_dates_applied",
    source: "gestor_iso",
    text: [
      "Fechas de etapa actualizadas",
      "",
      `Proyecto: ${getProjectClient(updatedProject)}`,
      `Etapa: ${getStageTitle(updatedStage || selectedStage)}`,
      `Inicio: ${formatDate(getStageStart(updatedStage || selectedStage))}`,
      `Término: ${formatDate(getStageEnd(updatedStage || selectedStage))}`,
      "",
      "Opciones:",
      `1. Ver etapa — /proyecto_etapa ${projectRef} | ${stageNumber}`,
      `2. Volver al proyecto — /proyecto_detalle ${projectRef}`,
      "",
      "Responde 1 para ver la etapa o 2 para volver al proyecto."
    ].join("\n")
  };
}

