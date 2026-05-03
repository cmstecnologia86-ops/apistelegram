import { gestorIsoRequest } from "./gestorIsoClient.js";

const TYPE_LABELS = {
  seguimiento: "Seguimiento",
  interna: "Interna",
  comercial: "Comercial",
  auditoria: "Auditoría",
  capacitacion: "Capacitación",
  otro: "Otro"
};

const STATUS_LABELS = {
  scheduled: "Programada",
  completed: "Realizada",
  cancelled: "Cancelada",
  draft: "Borrador"
};

const SCOPE_LABELS = {
  client: "Cliente",
  internal: "Interna",
  general: "General / varios clientes"
};

function normalizeOptionalText(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

function normalizeForMatch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(spa|s p a|ltda|limitada|sa|s a|eirl|sociedad|comercial|empresa)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeMeetingType(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (raw.includes("audit")) return "auditoria";
  if (raw.includes("auditor")) return "auditoria";
  if (raw.includes("capacit")) return "capacitacion";
  if (raw.includes("comercial")) return "comercial";
  if (raw.includes("intern")) return "interna";
  if (raw.includes("seguim")) return "seguimiento";

  return raw || "seguimiento";
}

function normalizeScope(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (raw === "client" || raw.includes("cliente")) return "client";
  if (raw === "internal" || raw.includes("intern")) return "internal";
  return "general";
}

function normalizeStatus(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (raw.includes("realiz") || raw === "completed") return "completed";
  if (raw.includes("cancel") || raw === "cancelled") return "cancelled";
  if (raw.includes("borrador") || raw === "draft") return "draft";
  return "scheduled";
}

function normalizeDateOnly(value) {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const match = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = match[2].padStart(2, "0");
    const year = match[3];
    return `${year}-${month}-${day}`;
  }

  return null;
}

function normalizeDateTime(value) {
  const text = normalizeOptionalText(value);
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) return text;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(text)) return text.replace(" ", "T");

  const dateOnly = normalizeDateOnly(text);
  if (dateOnly) return `${dateOnly}T10:00`;

  return null;
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!match) return String(value);

  const months = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sept", "oct", "nov", "dic"
  ];

  const year = match[1];
  const month = months[Number(match[2]) - 1] || match[2];
  const day = Number(match[3]);
  const hour = match[4];
  const minute = match[5];

  return `${day} ${month} ${year}, ${hour}:${minute}`;
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
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

function label(map, value, fallback = "Sin dato") {
  return map[value] || value || fallback;
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

function extractDateFromPrompt(prompt = "") {
  const text = String(prompt || "");

  const isoDate = text.match(/\b(20\d{2}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?\b/);
  if (isoDate) {
    return isoDate[2] ? `${isoDate[1]}T${isoDate[2]}` : `${isoDate[1]}T10:00`;
  }

  const numericDate = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](20\d{2})(?:\s+(\d{1,2}:\d{2}))?\b/);
  if (numericDate) {
    const day = numericDate[1].padStart(2, "0");
    const month = numericDate[2].padStart(2, "0");
    const year = numericDate[3];
    const hour = numericDate[4] || "10:00";
    return `${year}-${month}-${day}T${hour}`;
  }

  const monthMap = {
    enero: "01",
    febrero: "02",
    marzo: "03",
    abril: "04",
    mayo: "05",
    junio: "06",
    julio: "07",
    agosto: "08",
    septiembre: "09",
    setiembre: "09",
    octubre: "10",
    noviembre: "11",
    diciembre: "12"
  };

  const longDate = text.toLowerCase().match(/\b(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(20\d{2})(?:\s+a\s+las\s+(\d{1,2}:\d{2}))?/i);
  if (longDate) {
    const day = longDate[1].padStart(2, "0");
    const month = monthMap[longDate[2].normalize("NFD").replace(/[\u0300-\u036f]/g, "")];
    const year = longDate[3];
    const hour = longDate[4] || "10:00";
    if (month) return `${year}-${month}-${day}T${hour}`;
  }

  return null;
}

function extractUrlFromPrompt(prompt = "") {
  const match = String(prompt || "").match(/\bhttps?:\/\/[^\s)]+/i);
  return normalizeOptionalText(match?.[0]);
}

function extractLocationFromPrompt(prompt = "") {
  const text = String(prompt || "");

  if (/google\s*meet|meet\.google/i.test(text)) return "Google Meet";
  if (/zoom/i.test(text)) return "Zoom";
  if (/teams|microsoft\s*teams/i.test(text)) return "Microsoft Teams";
  if (/online|remota|remoto|virtual/i.test(text)) return "Online";
  if (/presencial/i.test(text)) return "Presencial";

  const match = text.match(/(?:modalidad|ubicaci[oó]n|lugar)\s*[:\-]?\s*([^.\n;,]+)/i);
  return normalizeOptionalText(match?.[1]);
}

function extractClientCandidateFromPrompt(prompt = "") {
  const text = String(prompt || "").replace(/\s+/g, " ").trim();

  const patterns = [
    /(?:crear|generar|registrar)\s+reuni[oó]n\s+para\s+(.+?)(?:\s+por\s+|\s+para\s+|\s+fecha\s+|\s+responsable\s+|\.|$)/i,
    /(?:cliente|empresa)\s*[:\-]?\s+(.+?)(?:\s+por\s+|\s+para\s+|\s+fecha\s+|\s+responsable\s+|\.|$)/i,
    /para\s+(.+?)(?:\s+por\s+|\s+para\s+|\s+fecha\s+|\s+responsable\s+|\.|$)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = normalizeOptionalText(match?.[1]);
    if (candidate && candidate.length >= 3) return candidate;
  }

  return null;
}

async function getClientCatalog() {
  try {
    const response = await gestorIsoRequest("/api/clients?limit=500");
    const clients =
      response?.data?.clients ||
      response?.clients ||
      response?.data?.items ||
      response?.items ||
      [];

    return Array.isArray(clients) ? clients : [];
  } catch {
    return [];
  }
}

function clientMatchScore(client, haystack) {
  const names = [
    client?.name,
    client?.legal_name,
    client?.business_name,
    client?.razon_social
  ].filter(Boolean);

  let best = 0;

  for (const name of names) {
    const normalizedName = normalizeForMatch(name);
    if (!normalizedName) continue;

    if (haystack.includes(normalizedName)) {
      best = Math.max(best, 100 + normalizedName.length);
      continue;
    }

    const tokens = normalizedName
      .split(" ")
      .filter((token) => token.length >= 3);

    if (!tokens.length) continue;

    const hits = tokens.filter((token) => haystack.includes(token)).length;
    const ratio = hits / tokens.length;

    if (ratio >= 0.75) best = Math.max(best, Math.round(ratio * 80) + hits);
  }

  return best;
}

async function resolveClientFromText(text = "") {
  const clients = await getClientCatalog();
  const haystack = normalizeForMatch(text);

  if (!haystack || !clients.length) return null;

  const ranked = clients
    .map((client) => ({
      client,
      score: clientMatchScore(client, haystack)
    }))
    .filter((item) => item.score >= 60)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.client || null;
  if (!best?.id) return null;

  return {
    id: String(best.id),
    name: best.name || best.legal_name || best.business_name || best.razon_social || null
  };
}

async function resolveClientFromPrompt(prompt = "") {
  const candidate = extractClientCandidateFromPrompt(prompt);
  if (candidate) {
    const resolved = await resolveClientFromText(candidate);
    if (resolved) return resolved;
  }

  return await resolveClientFromText(prompt);
}

async function resolveClientName(clientId) {
  const cleanId = normalizeOptionalText(clientId);
  if (!cleanId) return null;

  const clients = await getClientCatalog();
  const found = clients.find((client) => String(client?.id || "") === cleanId);

  return found?.name || found?.legal_name || found?.business_name || found?.razon_social || null;
}

function inferTitle(prompt = "", clientName = null) {
  const text = String(prompt || "");

  const explicit = text.match(/(?:t[ií]tulo|reuni[oó]n)\s*[:\-]\s*([^.\n]+)/i);
  if (explicit?.[1]) return normalizeOptionalText(explicit[1]);

  let topic = "Seguimiento";
  if (/iso\s*22000/i.test(text)) topic = "Seguimiento ISO 22000:2018";
  else if (/haccp/i.test(text)) topic = "Seguimiento HACCP";
  else if (/iso\s*9001/i.test(text)) topic = "Seguimiento ISO 9001";
  else if (/iso\s*14001/i.test(text)) topic = "Seguimiento ISO 14001";
  else if (/iso\s*45001/i.test(text)) topic = "Seguimiento ISO 45001";
  else if (/auditor/i.test(text)) topic = "Reunión de auditoría";
  else if (/comercial|cotizaci[oó]n|propuesta/i.test(text)) topic = "Reunión comercial";
  else if (/capacit/i.test(text)) topic = "Reunión de capacitación";

  return clientName ? `${topic} - ${clientName}` : topic;
}

function inferAgenda(prompt = "") {
  const text = String(prompt || "").trim();

  const explicit = text.match(/(?:agenda|temas|objetivo)\s*[:\-]\s*([^]+?)(?:\n\n|$)/i);
  if (explicit?.[1]) return normalizeOptionalText(explicit[1]);

  return text
    .replace(/^crear\s+reuni[oó]n\s+para\s+/i, "")
    .trim() || "Revisar antecedentes, estado de avance, pendientes y próximos pasos.";
}

function inferSummary(prompt = "", title = "") {
  const text = String(prompt || "");

  if (/iso\s*22000/i.test(text)) {
    return "Reunión de seguimiento para revisar estado del sistema de gestión de inocuidad, documentación, acciones pendientes y coordinación de próximas actividades.";
  }

  if (/haccp/i.test(text)) {
    return "Reunión de seguimiento para revisar avance del sistema HACCP, documentación, plan de mejoras y coordinación de auditoría.";
  }

  if (/auditor/i.test(text)) {
    return "Reunión para coordinar antecedentes, alcance, responsables, fechas y próximos pasos asociados al proceso de auditoría.";
  }

  return `Reunión asociada a ${title || "seguimiento operativo"}, con foco en revisión de antecedentes, coordinación y próximos pasos.`;
}

function sanitizeDraft(draft = {}) {
  const meetingDate = normalizeDateTime(draft.meeting_date) || extractDateFromPrompt(draft.original_prompt) || null;
  const meetingScope = normalizeScope(draft.meeting_scope);

  return {
    title: normalizeOptionalText(draft.title),
    meeting_type: normalizeMeetingType(draft.meeting_type),
    meeting_scope: meetingScope,
    status: normalizeStatus(draft.status),
    meeting_date: meetingDate,
    next_meeting_date: normalizeDateOnly(draft.next_meeting_date),
    location: normalizeOptionalText(draft.location),
    meeting_url: normalizeOptionalText(draft.meeting_url),
    client_id: meetingScope === "client" ? normalizeOptionalText(draft.client_id) : null,
    project_id: normalizeOptionalText(draft.project_id),
    owner_user_id: normalizeOptionalText(draft.owner_user_id),
    responsible_name: normalizeOptionalText(draft.responsible_name),
    agenda: normalizeOptionalText(draft.agenda),
    summary: normalizeOptionalText(draft.summary),
    notes: normalizeOptionalText(draft.notes)
  };
}

function formatDraftText(draft, clientName = null) {
  const clientLabel = draft.client_id
    ? clientName || `ID ${draft.client_id}`
    : draft.meeting_scope === "internal"
      ? "Reunión interna"
      : "General / varios clientes";

  return [
    "Borrador de nueva reunión",
    "",
    `Cliente detectado: ${clientLabel}`,
    `Cliente CQS asociado: ${draft.client_id ? "Sí" : "No"}`,
    "",
    `Reunión: ${draft.title || "Sin título"}`,
    `Tipo: ${label(TYPE_LABELS, draft.meeting_type)}`,
    `Estado: ${label(STATUS_LABELS, draft.status)}`,
    `Alcance: ${label(SCOPE_LABELS, draft.meeting_scope)}`,
    `Fecha: ${formatDateTime(draft.meeting_date)}`,
    `Próxima reunión: ${formatDate(draft.next_meeting_date)}`,
    `Ubicación / modalidad: ${draft.location || "Sin ubicación"}`,
    `URL: ${draft.meeting_url || "Sin URL"}`,
    `Responsable: ${draft.responsible_name || "sin responsable"}`,
    "",
    "Agenda:",
    draft.agenda || "Sin agenda.",
    "",
    "Resumen:",
    draft.summary || "Sin resumen.",
    "",
    "Notas:",
    draft.notes || "Sin notas.",
    "",
    "Opciones:",
    "1. Crear reunión real — /nueva_reunion_crear",
    "2. Cancelar — /nueva_reunion_cancelar",
    "",
    "Responde 1 para crear o 2 para cancelar."
  ].join("\n");
}

function formatCreateConfirmation(payload, clientName = null) {
  const clientLabel = payload.client_id
    ? clientName || `ID ${payload.client_id}`
    : payload.meeting_scope === "internal"
      ? "Reunión interna"
      : "General / varios clientes";

  return [
    "Confirmar creación de reunión",
    "",
    `Cliente: ${clientLabel}`,
    `Cliente CQS asociado: ${payload.client_id ? "Sí" : "No"}`,
    `Reunión: ${payload.title || "Sin título"}`,
    `Tipo: ${label(TYPE_LABELS, payload.meeting_type)}`,
    `Estado: ${label(STATUS_LABELS, payload.status)}`,
    `Alcance: ${label(SCOPE_LABELS, payload.meeting_scope)}`,
    `Fecha: ${formatDateTime(payload.meeting_date)}`,
    `Ubicación / modalidad: ${payload.location || "Sin ubicación"}`,
    "",
    "Opciones:",
    "1. Confirmar creación",
    "2. Cancelar",
    "",
    "Esta acción creará la reunión real en Gestor ISO."
  ].join("\n");
}

function formatCreatedMeeting(response, payload, clientName = null) {
  const meeting = response?.data?.meeting || response?.meeting || null;
  const id = response?.data?.id || meeting?.id || response?.id || "";
  const title = meeting?.title || payload.title;
  const clientLabel = clientName || meeting?.client_name || (payload.client_id ? `ID ${payload.client_id}` : "General / varios clientes");

  return [
    "Reunión creada correctamente",
    "",
    `Reunión: ${title}`,
    `Cliente: ${clientLabel}`,
    `Estado: ${label(STATUS_LABELS, meeting?.status || payload.status)}`,
    `Fecha: ${formatDateTime(meeting?.meeting_date || payload.meeting_date)}`,
    id ? `ID: ${id}` : "",
    "",
    "Ya quedó registrada en Gestor ISO."
  ].filter(Boolean).join("\n");
}

export async function getMeetingNewDraft({ prompt = "" } = {}) {
  const cleanPrompt = String(prompt || "").trim();

  if (!cleanPrompt) {
    return {
      ok: false,
      intent: "meeting_new_draft",
      source: "gestor_iso",
      text: "Debes indicar el contexto de la reunión. Ejemplo: /nueva_reunion Crear reunión para VALLES DE CHILE LTDA., seguimiento ISO 22000, fecha 2026-05-08 10:00, modalidad online."
    };
  }

  const client = await resolveClientFromPrompt(cleanPrompt);
  const responsibleName = extractResponsibleName(cleanPrompt);
  const meetingUrl = extractUrlFromPrompt(cleanPrompt);
  const location = extractLocationFromPrompt(cleanPrompt) || (meetingUrl ? "Online" : null);
  const meetingDate = extractDateFromPrompt(cleanPrompt);
  const meetingScope = client?.id ? "client" : /interna|cms interno|equipo cms/i.test(cleanPrompt) ? "internal" : "general";
  const title = inferTitle(cleanPrompt, client?.name || null);
  const agenda = inferAgenda(cleanPrompt);
  const summary = inferSummary(cleanPrompt, title);

  const draft = sanitizeDraft({
    original_prompt: cleanPrompt,
    title,
    meeting_type: normalizeMeetingType(cleanPrompt),
    meeting_scope: meetingScope,
    status: "scheduled",
    meeting_date: meetingDate,
    next_meeting_date: null,
    location,
    meeting_url: meetingUrl,
    client_id: client?.id || null,
    project_id: null,
    owner_user_id: null,
    responsible_name: responsibleName,
    agenda,
    summary,
    notes: client?.name
      ? `Reunión asociada al cliente ${client.name}.`
      : "Reunión general o interna sin cliente CQS asociado."
  });

  if (!draft.meeting_date) {
    return {
      ok: false,
      intent: "meeting_new_draft",
      source: "gestor_iso",
      text: "No pude detectar una fecha válida para la reunión. Indica una fecha en formato YYYY-MM-DD o DD-MM-YYYY, idealmente con hora. Ejemplo: 2026-05-08 10:00."
    };
  }

  return {
    ok: true,
    intent: "meeting_new_draft",
    source: "gestor_iso",
    text: formatDraftText(draft, client?.name || null),
    meta: {
      draft,
      client_name: client?.name || null
    }
  };
}

export async function getMeetingNewCreate({ draft = null, confirm = false } = {}) {
  if (!draft || typeof draft !== "object") {
    return {
      ok: false,
      intent: "meeting_new_create",
      source: "gestor_iso",
      text: "Falta el borrador de la reunión. Primero genera un borrador con /tasks/meeting-new-draft."
    };
  }

  const payload = sanitizeDraft(draft);

  if (!payload.title) {
    return {
      ok: false,
      intent: "meeting_new_create",
      source: "gestor_iso",
      text: "No puedo crear la reunión porque el borrador no tiene título."
    };
  }

  if (!payload.meeting_date) {
    return {
      ok: false,
      intent: "meeting_new_create",
      source: "gestor_iso",
      text: "No puedo crear la reunión porque no tiene fecha válida."
    };
  }

  if (payload.meeting_scope === "client" && !payload.client_id) {
    return {
      ok: false,
      intent: "meeting_new_create",
      source: "gestor_iso",
      text: "No puedo crear la reunión porque está marcada como reunión de cliente, pero no tiene cliente CQS asociado."
    };
  }

  const clientName = await resolveClientName(payload.client_id);

  if (!confirm) {
    return {
      ok: true,
      intent: "meeting_new_create_confirm",
      source: "gestor_iso",
      text: formatCreateConfirmation(payload, clientName),
      meta: {
        payload
      }
    };
  }

  const response = await gestorIsoRequest("/api/meetings", {
    method: "POST",
    body: payload
  });

  return {
    ok: true,
    intent: "meeting_new_created",
    source: "gestor_iso",
    text: formatCreatedMeeting(response, payload, clientName),
    meta: {
      response
    }
  };
}
