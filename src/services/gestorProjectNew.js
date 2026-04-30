import { gestorIsoRequest } from "./gestorIsoClient.js";

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

function statusLabel(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    draft: "Borrador",
    active: "Activo",
    in_progress: "En curso",
    pending: "Pendiente",
    done: "Finalizada",
    completed: "Finalizada",
    blocked: "Bloqueada",
    cancelled: "Cancelado"
  };

  return map[raw] || value || "Sin estado";
}

function priorityLabel(value = "") {
  const raw = String(value || "").trim().toLowerCase();

  const map = {
    low: "Baja",
    medium: "Media",
    high: "Alta",
    urgent: "Urgente"
  };

  return map[raw] || value || "Sin prioridad";
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
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

function matchScore(a = "", b = "") {
  const x = compactText(a);
  const y = compactText(b);

  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.94;

  return 0;
}

function standardMatches(draftStandard = "", clientStandard = "") {
  const draft = normalizeText(draftStandard);
  const client = normalizeText(clientStandard);

  if (!draft || !client) return true;
  if (draft === client) return true;
  if (draft.includes(client) || client.includes(draft)) return true;

  const draftTokens = new Set(draft.split(" ").filter(Boolean));
  const clientTokens = client.split(" ").filter(Boolean);

  return clientTokens.some((token) => draftTokens.has(token));
}

async function resolveCqsClientForDraft(draft = {}) {
  if (draft?.client_id) return draft;

  const detectedName = firstValue(draft?.detected_client_name, draft?.client_name, draft?.name);
  if (!detectedName) return draft;

  const params = new URLSearchParams();
  params.set("search", detectedName);
  params.set("limit", "20");

  const response = await gestorIsoRequest(`/api/clients?${params.toString()}`);
  const clients = Array.isArray(response?.data?.clients) ? response.data.clients : [];

  if (!clients.length) return draft;

  const detectedStandard = firstValue(draft?.detected_standard, "");

  const scored = clients
    .map((client) => {
      const nameScore = matchScore(detectedName, client?.name || "");
      const standardOk = standardMatches(detectedStandard, client?.standard || "");
      const score = nameScore + (standardOk ? 0.25 : 0);

      return { client, score, standardOk };
    })
    .filter((item) => item.score >= 0.90)
    .sort((a, b) => b.score - a.score);

  const best = scored[0]?.client;
  const clientId = firstValue(best?.id, best?.codigo, best?.code);

  if (!clientId) return draft;

  return {
    ...draft,
    client_id: String(clientId),
    detected_client_name: firstValue(draft.detected_client_name, best.name),
    detected_standard: firstValue(draft.detected_standard, best.standard),
    detected_scope_hint: firstValue(draft.detected_scope_hint, best.scope, best.alcance),
    cqs_fallback_match: {
      id: String(clientId),
      name: best.name || "",
      standard: best.standard || "",
      score: scored[0]?.score || 0
    }
  };
}

function getDraftFromResponse(response) {
  return response?.data?.draft || response?.draft || response?.data || null;
}

function looksLikeGenericResponsible(value = "") {
  const raw = normalizeText(value);

  return [
    "juan perez",
    "juan pérez",
    "maria perez",
    "maría pérez",
    "consultor responsable",
    "nombre responsable",
    "responsable proyecto",
    "responsable del proyecto"
  ].includes(raw);
}

function sanitizeDraft(draft = {}) {
  const clean = { ...draft };

  if (looksLikeGenericResponsible(clean.responsible_name)) {
    clean.responsible_name = "";
  }

  clean.tasks = safeArray(clean.tasks).map((task) => {
    const next = { ...task };

    if (looksLikeGenericResponsible(next.responsible_name)) {
      next.responsible_name = "";
    }

    return next;
  });

  return clean;
}

function countChecklist(tasks) {
  return safeArray(tasks).reduce((total, task) => total + safeArray(task?.results).length, 0);
}

function formatDraftSummary(draft) {
  const tasks = safeArray(draft?.tasks);
  const checklistTotal = countChecklist(tasks);

  const lines = [
    "Borrador de nuevo proyecto",
    "",
    `Cliente detectado: ${firstValue(draft?.detected_client_name, "sin cliente detectado")}`,
    `Cliente CQS asociado: ${draft?.client_id ? "Sí" : "No"}`,
    `Norma/servicio detectado: ${firstValue(draft?.detected_standard, "sin dato")}`,
    `Alcance detectado: ${firstValue(draft?.detected_scope_hint, "sin dato")}`,
    "",
    `Proyecto: ${firstValue(draft?.name, "Sin nombre")}`,
    `Código: ${firstValue(draft?.code, "sin código")}`,
    `Estado: ${statusLabel(draft?.status)}`,
    `Prioridad: ${priorityLabel(draft?.priority)}`,
    `Inicio: ${formatDate(draft?.start_date)}`,
    `Objetivo: ${formatDate(draft?.target_date)}`,
    `Responsable: ${firstValue(draft?.responsible_name, "sin responsable")}`,
    "",
    "Descripción:",
    firstValue(draft?.description, "sin descripción"),
    "",
    `Etapas detectadas: ${tasks.length}`,
    `Checklist detectado: ${checklistTotal} resultados`
  ];

  if (tasks.length) {
    lines.push("", "Etapas:");

    tasks.slice(0, 12).forEach((task, index) => {
      lines.push(`${index + 1}. ${firstValue(task?.title, `Etapa ${index + 1}`)} — ${statusLabel(task?.status)} — ${firstValue(task?.progress_percent, 0)}%`);
    });
  }

  lines.push(
    "",
    "Opciones:",
    "1. Crear proyecto",
    "2. Cancelar",
    "",
    "Nota: primero validaremos este borrador. En el siguiente paso conectaremos la confirmación para crear el proyecto real."
  );

  return lines.join("\n");
}

function normalizeOptionalText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function normalizePercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeTaskForCreate(task = {}, index = 0) {
  const title = normalizeOptionalText(task.title) || `Etapa ${index + 1}`;

  return {
    title,
    description: normalizeOptionalText(task.description),
    phase: normalizeOptionalText(task.phase) || `Etapa ${index + 1}`,
    order_index: index,
    start_date: normalizeOptionalText(task.start_date),
    end_date: normalizeOptionalText(task.end_date),
    progress_percent: normalizePercent(task.progress_percent),
    status: normalizeOptionalText(task.status) || "pending",
    responsible_name: normalizeOptionalText(task.responsible_name),
    responsible_email: normalizeOptionalText(task.responsible_email),
    notes: normalizeOptionalText(task.notes),
    results: safeArray(task.results)
      .map((result) => ({
        description: normalizeOptionalText(result?.description),
        is_completed: Boolean(result?.is_completed)
      }))
      .filter((result) => result.description)
  };
}

function normalizeDraftForCreate(draft = {}) {
  const tasks = safeArray(draft.tasks)
    .map((task, index) => normalizeTaskForCreate(task, index))
    .filter((task) => task.title);

  return {
    name: normalizeOptionalText(draft.name),
    client_id: draft.is_internal ? null : normalizeOptionalText(draft.client_id),
    code: normalizeOptionalText(draft.code),
    description: normalizeOptionalText(draft.description),
    status: normalizeOptionalText(draft.status) || "draft",
    priority: normalizeOptionalText(draft.priority) || "medium",
    start_date: normalizeOptionalText(draft.start_date),
    target_date: normalizeOptionalText(draft.target_date),
    end_date: normalizeOptionalText(draft.end_date),
    progress_percent: normalizePercent(draft.progress_percent),
    health: normalizeOptionalText(draft.health) || "good",
    is_internal: Boolean(draft.is_internal),
    notes: normalizeOptionalText(draft.notes),
    responsible_name: normalizeOptionalText(draft.responsible_name),
    responsible_email: normalizeOptionalText(draft.responsible_email),
    responsible_phone: normalizeOptionalText(draft.responsible_phone),
    tasks
  };
}

function formatCreateConfirmation(payload) {
  const checklistTotal = countChecklist(payload.tasks);

  return [
    "Confirmar creación de proyecto Gantt",
    "",
    `Proyecto: ${payload.name || "Sin nombre"}`,
    `Cliente CQS asociado: ${payload.client_id ? "Sí" : "No"}`,
    `Código: ${payload.code || "sin código"}`,
    `Estado: ${statusLabel(payload.status)}`,
    `Prioridad: ${priorityLabel(payload.priority)}`,
    `Inicio: ${formatDate(payload.start_date)}`,
    `Objetivo: ${formatDate(payload.target_date)}`,
    `Responsable: ${payload.responsible_name || "sin responsable"}`,
    "",
    `Etapas: ${payload.tasks.length}`,
    `Checklist: ${checklistTotal} resultados`,
    "",
    "Opciones:",
    "1. Confirmar creación",
    "2. Cancelar",
    "",
    "Esta acción creará el proyecto real en Gestor ISO."
  ].join("\n");
}

function formatCreatedProject(response, payload) {
  const id = response?.data?.id || response?.id || "";
  const project = response?.data?.project || response?.project || null;
  const projectName = project?.name || payload.name;

  return [
    "Proyecto Gantt creado",
    "",
    `Proyecto: ${projectName}`,
    `ID: ${id || "sin id"}`,
    `Cliente CQS asociado: ${payload.client_id ? "Sí" : "No"}`,
    `Inicio: ${formatDate(payload.start_date)}`,
    `Objetivo: ${formatDate(payload.target_date)}`,
    `Etapas: ${payload.tasks.length}`,
    "",
    "Opciones:",
    `1. Ver proyectos — /proyectos`,
    id ? `2. Ver detalle — /proyecto_detalle ${payload.code || projectName}` : "2. Ver detalle — /proyectos",
    "",
    "Proyecto creado correctamente."
  ].join("\n");
}

export async function getProjectNewCreate({ draft = null, confirm = false } = {}) {
  if (!draft || typeof draft !== "object") {
    return {
      ok: false,
      intent: "project_new_create",
      source: "gestor_iso",
      text: "Falta el borrador del proyecto. Primero genera un borrador con /tasks/project-new-draft."
    };
  }

  const payload = normalizeDraftForCreate(sanitizeDraft(draft));

  if (!payload.name) {
    return {
      ok: false,
      intent: "project_new_create",
      source: "gestor_iso",
      text: "No puedo crear el proyecto porque el borrador no tiene nombre."
    };
  }

  if (!payload.tasks.length) {
    return {
      ok: false,
      intent: "project_new_create",
      source: "gestor_iso",
      text: "No puedo crear el proyecto porque el borrador no tiene etapas."
    };
  }

  if (!payload.is_internal && !payload.client_id) {
    return {
      ok: false,
      intent: "project_new_create",
      source: "gestor_iso",
      text: "No puedo crear el proyecto porque no tiene cliente CQS asociado. Primero ajusta el contexto o busca el cliente correcto."
    };
  }

  if (!confirm) {
    return {
      ok: true,
      intent: "project_new_create_confirm",
      source: "gestor_iso",
      text: formatCreateConfirmation(payload),
      meta: {
        payload
      }
    };
  }

  const response = await gestorIsoRequest("/api/gantt-projects", {
    method: "POST",
    body: payload
  });

  return {
    ok: true,
    intent: "project_new_created",
    source: "gestor_iso",
    text: formatCreatedProject(response, payload),
    meta: {
      response
    }
  };
}


export async function getProjectNewDraft({ prompt = "" } = {}) {
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt) {
    return {
      ok: false,
      intent: "project_new_draft",
      source: "gestor_iso",
      text: "Debes indicar el contexto del proyecto. Ejemplo: /nuevo_proyecto Crear proyecto para Rivas Food, implementación HACCP, inicio 2026-05-10, término 2026-07-30."
    };
  }

  const enrichedPrompt = [
    "Instrucciones operativas para este borrador:",
    "- No inventes nombres de responsables.",
    "- Si el usuario no indica responsable, deja responsible_name, responsible_email y responsible_phone vacíos.",
    "- No uses nombres de ejemplo como Juan Pérez, María Pérez o Consultor responsable.",
    "- Mantén la asociación al cliente CQS exacto si existe coincidencia clara.",
    "",
    "Contexto entregado por el usuario:",
    cleanPrompt
  ].join("\n");

  const response = await gestorIsoRequest("/api/gantt-projects/ai-draft", {
    method: "POST",
    body: {
      prompt: enrichedPrompt
    }
  });

  const rawDraft = getDraftFromResponse(response);
  const draft = rawDraft && typeof rawDraft === "object"
    ? sanitizeDraft(await resolveCqsClientForDraft(rawDraft))
    : rawDraft;

  if (!draft || typeof draft !== "object") {
    return {
      ok: false,
      intent: "project_new_draft",
      source: "gestor_iso",
      text: "Gestor ISO respondió, pero no devolvió un borrador utilizable."
    };
  }

  return {
    ok: true,
    intent: "project_new_draft",
    source: "gestor_iso",
    text: formatDraftSummary(draft),
    meta: {
      draft
    }
  };
}
