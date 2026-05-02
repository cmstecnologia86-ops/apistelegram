import { gestorIsoRequest } from "./gestorIsoClient.js";

const STATUS_LABELS = {
  draft: "Borrador",
  in_progress: "En curso",
  in_review: "En revisión",
  on_hold: "En espera",
  completed: "Completada",
  cancelled: "Cancelada"
};

const PRIORITY_LABELS = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente"
};

const CATEGORY_LABELS = {
  consultoria: "Consultoría",
  auditoria: "Auditoría",
  capacitacion: "Capacitación",
  implementacion: "Implementación",
  otro: "Otro"
};

const STAGE_LABELS = {
  diagnostico: "Diagnóstico",
  planificacion: "Planificación",
  implementacion: "Implementación",
  seguimiento: "Seguimiento",
  auditoria_interna: "Auditoría interna",
  cierre: "Cierre"
};

function normalizeOptionalText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeDate(value) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function normalizePercent(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function label(map, value, fallback = "Sin dato") {
  return map[value] || value || fallback;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return String(value);

  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sept", "oct", "nov", "dic"
  ];

  const year = match[1];
  const month = months[Number(match[2]) - 1] || match[2];
  const day = Number(match[3]);

  return `${day} ${month} ${year}`;
}

function extractResponsibleName(prompt = "") {
  const text = String(prompt || "");
  const match = text.match(/responsable\s*[:\-]?\s*([^.\n;,]+)/i);
  if (!match) return null;

  const value = normalizeOptionalText(match[1]);
  if (!value) return null;

  const forbidden = ["no indicado", "sin responsable", "pendiente"];
  if (forbidden.some((item) => value.toLowerCase().includes(item))) return null;

  return value;
}

function sanitizeDraft(draft = {}) {
  return {
    name: normalizeOptionalText(draft.name),
    client_id: normalizeBoolean(draft.is_internal) ? null : normalizeOptionalText(draft.client_id),
    code: normalizeOptionalText(draft.code),
    description: normalizeOptionalText(draft.description),
    category: normalizeOptionalText(draft.category) || "consultoria",
    stage: normalizeOptionalText(draft.stage) || "diagnostico",
    status: normalizeOptionalText(draft.status) || "draft",
    priority: normalizeOptionalText(draft.priority) || "medium",
    owner_user_id: normalizeOptionalText(draft.owner_user_id),
    responsible_name: normalizeOptionalText(draft.responsible_name),
    responsible_email: normalizeOptionalText(draft.responsible_email),
    responsible_phone: normalizeOptionalText(draft.responsible_phone),
    start_date: normalizeDate(draft.start_date),
    target_date: normalizeDate(draft.target_date),
    end_date: normalizeDate(draft.end_date),
    progress_percent: normalizePercent(draft.progress_percent),
    health: normalizeOptionalText(draft.health) || "good",
    is_internal: normalizeBoolean(draft.is_internal),
    notes: normalizeOptionalText(draft.notes),
    client_color: normalizeOptionalText(draft.client_color)
  };
}

async function resolveClientName(clientId) {
  const cleanId = normalizeOptionalText(clientId);
  if (!cleanId) return null;

  try {
    const response = await gestorIsoRequest("/api/clients?limit=500");
    const clients =
      response?.data?.clients ||
      response?.clients ||
      response?.data?.items ||
      response?.items ||
      [];

    const found = Array.isArray(clients)
      ? clients.find((client) => String(client?.id || "") === cleanId)
      : null;

    return found?.name || found?.legal_name || null;
  } catch {
    return null;
  }
}

function formatDraftText(draft, clientName = null) {
  const clientLabel = draft.client_id
    ? clientName || `ID ${draft.client_id}`
    : draft.is_internal
      ? "Actividad interna"
      : "No asociado";

  return [
    "Borrador de nueva actividad",
    "",
    `Cliente detectado: ${clientLabel}`,
    `Cliente CQS asociado: ${draft.client_id ? "Sí" : "No"}`,
    "",
    `Actividad: ${draft.name || "Sin nombre"}`,
    `Código: ${draft.code || "sin código"}`,
    `Tipo: ${label(CATEGORY_LABELS, draft.category)}`,
    `Etapa: ${label(STAGE_LABELS, draft.stage)}`,
    `Estado: ${label(STATUS_LABELS, draft.status)}`,
    `Prioridad: ${label(PRIORITY_LABELS, draft.priority)}`,
    `Inicio: ${formatDate(draft.start_date)}`,
    `Objetivo: ${formatDate(draft.target_date)}`,
    `Cierre: ${formatDate(draft.end_date)}`,
    `Avance: ${draft.progress_percent || 0}%`,
    `Responsable: ${draft.responsible_name || "sin responsable"}`,
    "",
    "Descripción:",
    draft.description || "Sin descripción.",
    "",
    "Notas:",
    draft.notes || "Sin notas.",
    "",
    "Opciones:",
    "1. Crear actividad real — /nueva_actividad_crear",
    "2. Cancelar — /nueva_actividad_cancelar",
    "",
    "Responde 1 para crear o 2 para cancelar."
  ].join("\n");
}

function formatCreateConfirmation(payload, clientName = null) {
  const clientLabel = payload.client_id
    ? clientName || `ID ${payload.client_id}`
    : payload.is_internal
      ? "Actividad interna"
      : "No asociado";

  return [
    "Confirmar creación de actividad",
    "",
    `Cliente: ${clientLabel}`,
    `Cliente CQS asociado: ${payload.client_id ? "Sí" : "No"}`,
    `Actividad: ${payload.name || "Sin nombre"}`,
    `Código: ${payload.code || "sin código"}`,
    `Estado: ${label(STATUS_LABELS, payload.status)}`,
    `Prioridad: ${label(PRIORITY_LABELS, payload.priority)}`,
    `Inicio: ${formatDate(payload.start_date)}`,
    `Objetivo: ${formatDate(payload.target_date)}`,
    `Responsable: ${payload.responsible_name || "sin responsable"}`,
    "",
    "Opciones:",
    "1. Confirmar creación",
    "2. Cancelar",
    "",
    "Esta acción creará la actividad real en Gestor ISO."
  ].join("\n");
}

function formatCreatedActivity(response, payload, clientName = null) {
  const project = response?.data?.project || response?.project || null;
  const id = response?.data?.id || project?.id || response?.id || "";
  const name = project?.name || payload.name;
  const clientLabel = clientName || project?.client_name || (payload.client_id ? `ID ${payload.client_id}` : "Actividad interna");

  return [
    "Actividad creada correctamente",
    "",
    `Actividad: ${name}`,
    `Cliente: ${clientLabel}`,
    `Estado: ${label(STATUS_LABELS, project?.status || payload.status)}`,
    `Prioridad: ${label(PRIORITY_LABELS, project?.priority || payload.priority)}`,
    id ? `ID: ${id}` : "",
    "",
    "Ya quedó registrada en Gestor ISO."
  ].filter(Boolean).join("\n");
}

export async function getActivityNewDraft({ prompt = "" } = {}) {
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt) {
    return {
      ok: false,
      intent: "activity_new_draft",
      source: "gestor_iso",
      text: "Debes indicar el contexto de la actividad. Ejemplo: /nueva_actividad Crear actividad para MEALS & CO. SPA, seguimiento HACCP 2026, revisar plan de mejoras y documentación pendiente."
    };
  }

  const enrichedPrompt = [
    "Instrucciones operativas para este borrador:",
    "- Genera una actividad operativa del módulo projects de Gestor ISO.",
    "- No inventes clientes. Usa solo cliente del catálogo si hay coincidencia clara.",
    "- Si no hay coincidencia clara, deja la actividad como interna.",
    "- No inventes responsables.",
    "- Si el usuario indica responsable explícitamente, se usará como responsable externo.",
    "- Mantén fechas en formato YYYY-MM-DD.",
    "",
    "Contexto entregado por el usuario:",
    cleanPrompt
  ].join("\n");

  const response = await gestorIsoRequest("/api/projects/ai-draft", {
    method: "POST",
    body: {
      prompt: enrichedPrompt
    }
  });

  if (!response?.ok) {
    return {
      ok: false,
      intent: "activity_new_draft",
      source: "gestor_iso",
      text: response?.error || "No fue posible generar el borrador de actividad.",
      meta: {
        response
      }
    };
  }

  const responsibleFromPrompt = extractResponsibleName(cleanPrompt);
  const draft = sanitizeDraft({
    ...(response?.data?.draft || {}),
    responsible_name: responsibleFromPrompt || response?.data?.draft?.responsible_name || null
  });

  const clientName = await resolveClientName(draft.client_id);

  return {
    ok: true,
    intent: "activity_new_draft",
    source: "gestor_iso",
    text: formatDraftText(draft, clientName),
    meta: {
      draft,
      client_name: clientName,
      response
    }
  };
}

export async function getActivityNewCreate({ draft = null, confirm = false } = {}) {
  if (!draft || typeof draft !== "object") {
    return {
      ok: false,
      intent: "activity_new_create",
      source: "gestor_iso",
      text: "Falta el borrador de la actividad. Primero genera un borrador con /tasks/activity-new-draft."
    };
  }

  const payload = sanitizeDraft(draft);

  if (!payload.name) {
    return {
      ok: false,
      intent: "activity_new_create",
      source: "gestor_iso",
      text: "No puedo crear la actividad porque el borrador no tiene nombre."
    };
  }

  if (!payload.is_internal && !payload.client_id) {
    return {
      ok: false,
      intent: "activity_new_create",
      source: "gestor_iso",
      text: "No puedo crear la actividad porque no tiene cliente CQS asociado. Ajusta el contexto o indica que es actividad interna."
    };
  }

  const clientName = await resolveClientName(payload.client_id);

  if (!confirm) {
    return {
      ok: true,
      intent: "activity_new_create_confirm",
      source: "gestor_iso",
      text: formatCreateConfirmation(payload, clientName),
      meta: {
        payload
      }
    };
  }

  const response = await gestorIsoRequest("/api/projects", {
    method: "POST",
    body: payload
  });

  return {
    ok: true,
    intent: "activity_new_created",
    source: "gestor_iso",
    text: formatCreatedActivity(response, payload, clientName),
    meta: {
      response
    }
  };
}
