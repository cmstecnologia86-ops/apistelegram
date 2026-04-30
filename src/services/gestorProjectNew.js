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

function getDraftFromResponse(response) {
  return response?.data?.draft || response?.draft || response?.data || null;
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

  const response = await gestorIsoRequest("/api/gantt-projects/ai-draft", {
    method: "POST",
    body: {
      prompt: cleanPrompt
    }
  });

  const draft = getDraftFromResponse(response);

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
