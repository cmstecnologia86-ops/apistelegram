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
    blocked: "Bloqueada",
    bloqueado: "Bloqueada"
  };

  return map[raw] || value || "Sin estado";
}

function validStatus(value = "") {
  const raw = normalizeText(value).replace(/\s+/g, "_");

  const map = {
    pending: "pending",
    pendiente: "pending",
    in_progress: "in_progress",
    en_curso: "in_progress",
    curso: "in_progress",
    done: "done",
    completed: "done",
    completado: "done",
    bloqueado: "blocked",
    blocked: "blocked",
    en_espera: "blocked"
  };

  return map[raw] || null;
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

function formatStatusOptions(project, stage, stageNumber) {
  const projectRef = getProjectCode(project) || getProjectTitle(project);

  return [
    `Editar estado · Etapa #${stageNumber}`,
    "",
    `Proyecto: ${getProjectClient(project)}`,
    `Etapa: ${getStageTitle(stage)}`,
    `Estado actual: ${getStageStatus(stage)}`,
    "",
    "Opciones:",
    `1. Estado 1: Pendiente — /proyecto_estado_confirmar ${projectRef} | ${stageNumber} | pending`,
    `2. Estado 2: En curso — /proyecto_estado_confirmar ${projectRef} | ${stageNumber} | in_progress`,
    `3. Estado 3: Finalizada — /proyecto_estado_confirmar ${projectRef} | ${stageNumber} | done`,
    `4. Estado 4: Bloqueada — /proyecto_estado_confirmar ${projectRef} | ${stageNumber} | blocked`,
    "",
    "Responde con el número del nuevo estado."
  ].join("\n");
}

function formatConfirm(project, stage, stageNumber, nextStatus) {
  const projectRef = getProjectCode(project) || getProjectTitle(project);

  return [
    "Confirmar cambio de estado",
    "",
    `Proyecto: ${getProjectClient(project)}`,
    `Etapa: ${getStageTitle(stage)}`,
    `Estado actual: ${getStageStatus(stage)}`,
    `Nuevo estado: ${statusLabel(nextStatus)}`,
    "",
    "Opciones:",
    `1. Confirmar cambio — /proyecto_estado_aplicar ${projectRef} | ${stageNumber} | ${nextStatus}`,
    `2. Cancelar y volver — /proyecto_etapa ${projectRef} | ${stageNumber}`,
    "",
    "Responde 1 para confirmar o 2 para cancelar."
  ].join("\n");
}

export async function getProjectStageStatus({
  query = "",
  stage = null,
  status = "",
  confirm = false
} = {}) {
  const cleanQuery = String(query || "").trim();
  const stageNumber = Number(stage || 0);

  if (!cleanQuery || !stageNumber) {
    return {
      ok: false,
      intent: "project_stage_status",
      source: "gestor_iso",
      text: "Debes indicar proyecto y etapa. Ejemplo: /proyecto_estado RIVAS-ISO-HACCP-2026 | 1"
    };
  }

  const project = await resolveProject(cleanQuery);

  if (!project) {
    return {
      ok: false,
      intent: "project_stage_status",
      source: "gestor_iso",
      text: `No encontré proyecto para: ${cleanQuery}`
    };
  }

  const { stage: selectedStage } = getStageByNumber(project, stageNumber);

  if (!selectedStage) {
    return {
      ok: false,
      intent: "project_stage_status",
      source: "gestor_iso",
      text: `No encontré la etapa ${stageNumber} para este proyecto.`
    };
  }

  const nextStatus = validStatus(status);

  if (!nextStatus) {
    return {
      ok: true,
      intent: "project_stage_status",
      source: "gestor_iso",
      text: formatStatusOptions(project, selectedStage, stageNumber)
    };
  }

  if (!confirm) {
    return {
      ok: true,
      intent: "project_stage_status_confirm",
      source: "gestor_iso",
      text: formatConfirm(project, selectedStage, stageNumber, nextStatus)
    };
  }

  const id = projectId(project);
  const taskId = getStageId(selectedStage);

  if (!id || !taskId) {
    return {
      ok: false,
      intent: "project_stage_status_apply",
      source: "gestor_iso",
      text: "No pude identificar el ID interno del proyecto o de la etapa."
    };
  }

  const updateBody = {
    status: nextStatus
  };

  if (nextStatus === "done") {
    updateBody.progress_percent = 100;
  }

  await gestorIsoRequest(`/api/gantt-projects/${encodeURIComponent(id)}/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: updateBody
  });

  const updatedProject = await fetchProjectById(id);
  const { stage: updatedStage } = getStageByNumber(updatedProject, stageNumber);
  const projectRef = getProjectCode(updatedProject) || getProjectTitle(updatedProject);

  return {
    ok: true,
    intent: "project_stage_status_applied",
    source: "gestor_iso",
    text: [
      "Estado de etapa actualizado",
      "",
      `Proyecto: ${getProjectClient(updatedProject)}`,
      `Etapa: ${getStageTitle(updatedStage || selectedStage)}`,
      `Nuevo estado: ${getStageStatus(updatedStage || { status: nextStatus })}`,
      "",
      "Opciones:",
      `1. Ver etapa — /proyecto_etapa ${projectRef} | ${stageNumber}`,
      `2. Volver al proyecto — /proyecto_detalle ${projectRef}`,
      "",
      "Responde 1 para ver la etapa o 2 para volver al proyecto."
    ].join("\n")
  };
}

