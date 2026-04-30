import { gestorIsoRequest } from "./gestorIsoClient.js";

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstValue(...values) {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return value;
  }
  return null;
}

function statusLabel(value = "") {
  const raw = normalizeText(value);
  const map = {
    pending: "Pendiente",
    pendiente: "Pendiente",
    in_progress: "En curso",
    "in progress": "En curso",
    "en curso": "En curso",
    done: "Finalizada",
    completed: "Finalizada",
    completado: "Finalizada",
    finalizado: "Finalizada",
    finalizada: "Finalizada",
    blocked: "Bloqueada",
    bloqueado: "Bloqueada",
    bloqueada: "Bloqueada"
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

function parseProgress(value) {
  if (value === undefined || value === null || value === "") return null;

  const raw = String(value).replace("%", "").trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;

  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0 || n > 100) return null;

  return Math.round(n);
}

function getProjectCode(project = {}) {
  return firstValue(project.code, project.codigo, project.project_code, project.projectCode);
}

function getProjectTitle(project = {}) {
  return firstValue(project.name, project.title, project.nombre, project.project_name, project.projectName) || "Sin nombre";
}

function getProjectClient(project = {}) {
  return firstValue(project.client_name, project.clientName, project.client, project.cliente, project.empresa) || "Sin cliente";
}

function projectId(project = {}) {
  return firstValue(project.id, project.project_id, project.projectId, project.uuid, project.slug);
}

function getStageTitle(stage = {}) {
  return firstValue(stage.title, stage.name, stage.stage_name, stage.stageName, stage.nombre, stage.phase, stage.fase) || "Sin nombre de etapa";
}

function getStageStatus(stage = {}) {
  return statusLabel(firstValue(stage.status, stage.estado, stage.state));
}

function getStageProgress(stage = {}) {
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

function getStageId(stage = {}) {
  return firstValue(stage.id, stage.task_id, stage.taskId, stage.uuid);
}

function extractProjects(response) {
  const candidates = [
    response?.data?.ganttProjects,
    response?.data?.gantt_projects,
    response?.data?.projects,
    response?.ganttProjects,
    response?.gantt_projects,
    response?.projects,
    response?.data
  ];

  for (const item of candidates) {
    if (Array.isArray(item)) return item;
  }

  return [];
}

function extractStages(project) {
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
  const normalizedQuery = normalizeText(cleanQuery);

  const projects = await fetchProjects();

  const selected = projects.find((project) => {
    return normalizeText(getProjectCode(project)) === normalizedQuery;
  }) || projects.find((project) => {
    return normalizeText(getProjectTitle(project)) === normalizedQuery;
  }) || projects.find((project) => {
    const haystack = normalizeText([
      getProjectCode(project),
      getProjectTitle(project),
      getProjectClient(project)
    ].filter(Boolean).join(" "));
    return haystack.includes(normalizedQuery);
  });

  if (!selected) return null;

  const id = projectId(selected);
  if (!id) return selected;

  return await fetchProjectById(id);
}

function getStageByNumber(project, stageNumber) {
  const stages = extractStages(project);
  const index = Math.max(Number(stageNumber) || 1, 1) - 1;

  return {
    stage: stages[index] || null,
    index,
    stages
  };
}

function formatProgressOptions(project, stage, stageNumber) {
  const projectRef = getProjectCode(project) || getProjectTitle(project);

  return [
    `Editar avance · Etapa #${stageNumber}`,
    "",
    `Proyecto: ${getProjectClient(project)}`,
    `Etapa: ${getStageTitle(stage)}`,
    `Estado actual: ${getStageStatus(stage)}`,
    `Avance actual: ${getStageProgress(stage)}`,
    "",
    "Opciones:",
    `1. Avance 0% — /proyecto_avance_confirmar ${projectRef} | ${stageNumber} | 0`,
    `2. Avance 25% — /proyecto_avance_confirmar ${projectRef} | ${stageNumber} | 25`,
    `3. Avance 50% — /proyecto_avance_confirmar ${projectRef} | ${stageNumber} | 50`,
    `4. Avance 75% — /proyecto_avance_confirmar ${projectRef} | ${stageNumber} | 75`,
    `5. Avance 100% — /proyecto_avance_confirmar ${projectRef} | ${stageNumber} | 100`,
    "",
    "Responde con el número del nuevo avance."
  ].join("\n");
}

function formatConfirm(project, stage, stageNumber, nextProgress) {
  const projectRef = getProjectCode(project) || getProjectTitle(project);

  const note = nextProgress === 100
    ? ["", "Nota: si el avance queda en 100%, recuerda revisar si el estado también debe quedar como Finalizada."]
    : [];

  return [
    "Confirmar cambio de avance",
    "",
    `Proyecto: ${getProjectClient(project)}`,
    `Etapa: ${getStageTitle(stage)}`,
    `Estado actual: ${getStageStatus(stage)}`,
    `Avance actual: ${getStageProgress(stage)}`,
    `Nuevo avance: ${nextProgress}%`,
    ...note,
    "",
    "Opciones:",
    `1. /proyecto_avance_aplicar ${projectRef} | ${stageNumber} | ${nextProgress}`,
    `2. /proyecto_etapa ${projectRef} | ${stageNumber}`,
    "",
    "Responde 1 para confirmar o 2 para cancelar."
  ].join("\n");
}

export async function getProjectStageProgress({
  query = "",
  stage = null,
  progress = null,
  confirm = false
} = {}) {
  const cleanQuery = String(query || "").trim();
  const stageNumber = Number(stage || 0);

  if (!cleanQuery || !stageNumber) {
    return {
      ok: false,
      intent: "project_stage_progress",
      source: "gestor_iso",
      text: "Debes indicar proyecto y etapa. Ejemplo: /proyecto_avance RIVAS-ISO-HACCP-2026 | 1"
    };
  }

  const project = await resolveProject(cleanQuery);

  if (!project) {
    return {
      ok: false,
      intent: "project_stage_progress",
      source: "gestor_iso",
      text: `No encontré proyecto para: ${cleanQuery}`
    };
  }

  const { stage: selectedStage } = getStageByNumber(project, stageNumber);

  if (!selectedStage) {
    return {
      ok: false,
      intent: "project_stage_progress",
      source: "gestor_iso",
      text: `No encontré la etapa ${stageNumber} para este proyecto.`
    };
  }

  const nextProgress = parseProgress(progress);

  if (nextProgress === null) {
    return {
      ok: true,
      intent: "project_stage_progress",
      source: "gestor_iso",
      text: formatProgressOptions(project, selectedStage, stageNumber)
    };
  }

  if (!confirm) {
    return {
      ok: true,
      intent: "project_stage_progress_confirm",
      source: "gestor_iso",
      text: formatConfirm(project, selectedStage, stageNumber, nextProgress)
    };
  }

  const id = projectId(project);
  const taskId = getStageId(selectedStage);

  if (!id || !taskId) {
    return {
      ok: false,
      intent: "project_stage_progress_apply",
      source: "gestor_iso",
      text: "No pude identificar el ID interno del proyecto o de la etapa."
    };
  }

  await gestorIsoRequest(`/api/gantt-projects/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: {
      progress_percent: nextProgress
    }
  });

  const updatedProject = await fetchProjectById(id);
  const { stage: updatedStage } = getStageByNumber(updatedProject, stageNumber);
  const projectRef = getProjectCode(updatedProject) || getProjectTitle(updatedProject);

  return {
    ok: true,
    intent: "project_stage_progress_applied",
    source: "gestor_iso",
    text: [
      "Avance de etapa actualizado",
      "",
      `Proyecto: ${getProjectClient(updatedProject)}`,
      `Etapa: ${getStageTitle(updatedStage || selectedStage)}`,
      `Nuevo avance: ${getStageProgress(updatedStage || { progress_percent: nextProgress })}`,
      `Estado actual: ${getStageStatus(updatedStage || selectedStage)}`,
      "",
      "Opciones:",
      `1. /proyecto_etapa ${projectRef} | ${stageNumber}`,
      `2. /proyecto_detalle ${projectRef}`,
      "",
      "Responde 1 para ver la etapa o 2 para volver al proyecto."
    ].join("\n")
  };
}
