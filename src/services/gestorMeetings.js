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

function getMeetingTitle(meeting) {
  return firstValue(
    meeting.title,
    meeting.name,
    meeting.subject,
    meeting.meeting_title,
    meeting.meetingTitle,
    meeting.activity_name,
    meeting.activityName
  ) || "Sin nombre de reunión";
}

function getMeetingClient(meeting) {
  return firstValue(
    meeting.client_name,
    meeting.clientName,
    meeting.client?.name,
    meeting.client,
    meeting.company_name,
    meeting.customer_name
  ) || "Sin cliente";
}

function getMeetingDescription(meeting) {
  return firstValue(
    meeting.description,
    meeting.summary,
    meeting.objective,
    meeting.notes,
    meeting.detail,
    meeting.details,
    meeting.agenda,
    meeting.observation,
    meeting.observations
  ) || "Sin descripción registrada.";
}

function getMeetingDate(meeting) {
  return firstValue(
    meeting.meeting_date,
    meeting.meetingDate,
    meeting.scheduled_at,
    meeting.scheduledAt,
    meeting.start_time,
    meeting.startTime,
    meeting.date,
    meeting.fecha,
    meeting.fecha_reunion,
    meeting.due_date,
    meeting.created_at
  );
}

function getMeetingStatus(meeting) {
  return String(firstValue(
    meeting.status,
    meeting.state,
    meeting.estado,
    meeting.meeting_status
  ) || "activa").toLowerCase();
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
  const da = parseDateValue(getMeetingDate(a));
  const db = parseDateValue(getMeetingDate(b));

  if (da && db) return da - db;
  if (da && !db) return -1;
  if (!da && db) return 1;
  return 0;
}

function extractMeetings(response) {
  const candidates = [
    response?.data?.meetings,
    response?.data?.reuniones,
    response?.meetings,
    response?.reuniones,
    response?.workspace?.meetings,
    response?.workspace?.reuniones,
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

async function fetchMeetingsFromGestor() {
  const endpoints = [
    "/api/meetings?limit=300",
    "/api/reuniones?limit=300",
    "/api/workspace/meetings?limit=300",
    "/api/workspace/reuniones?limit=300",
    "/api/workspace/summary"
  ];

  const errors = [];

  for (const endpoint of endpoints) {
    try {
      const response = await gestorIsoRequest(endpoint);
      const meetings = extractMeetings(response);

      if (meetings.length) {
        return {
          endpoint,
          meetings
        };
      }
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }

  return {
    endpoint: null,
    meetings: [],
    errors
  };
}

function isActiveMeeting(meeting) {
  const status = normalizeText(getMeetingStatus(meeting));
  const inactive = ["completado", "completada", "completed", "cancelado", "cancelada", "cancelled", "cerrado", "cerrada"];

  return !inactive.some((word) => status.includes(word));
}

function matchesQuery(meeting, query) {
  const q = normalizeText(query);
  const qc = compactText(query);

  const values = [
    getMeetingTitle(meeting),
    getMeetingClient(meeting),
    getMeetingDescription(meeting),
    getMeetingStatus(meeting)
  ];

  return values.some((value) => {
    const normalized = normalizeText(value);
    const compacted = compactText(value);

    return normalized.includes(q) || compacted.includes(qc);
  });
}

function scoreMeeting(query, meeting) {
  const values = [
    getMeetingClient(meeting),
    getMeetingTitle(meeting),
    getMeetingDescription(meeting)
  ];

  return Math.max(...values.map((value) => similarity(query, value)));
}

function formatMeetingList(meetings, { title = "Reuniones activas", page = 1, limit = 5, query = "" } = {}) {
  const sorted = [...meetings].sort(sortByDateAscNoDateLast);
  const safeLimit = Math.min(Math.max(Number(limit) || 5, 1), 10);
  const total = sorted.length;
  const totalPages = Math.max(Math.ceil(total / safeLimit), 1);
  const currentPage = Math.min(Math.max(Number(page) || 1, 1), totalPages);
  const start = (currentPage - 1) * safeLimit;
  const end = start + safeLimit;
  const pageItems = sorted.slice(start, end);

  const lines = pageItems.map((meeting, index) => {
    const n = start + index + 1;
    const client = getMeetingClient(meeting);
    const meetingTitle = getMeetingTitle(meeting);
    const date = formatDate(getMeetingDate(meeting));

    return `${n}. ${meetingTitle} — ${client} — ${date}`;
  });

  const nextHint = currentPage < totalPages
    ? `\n\nPara ver más: /reuniones${query ? ` ${query}` : ""} ${currentPage + 1}`
    : "";

  return `${title}\nPágina ${currentPage}/${totalPages} · ${start + 1}-${Math.min(end, total)} de ${total}\n\n${lines.join("\n")}\n\nResponde con el número de la reunión para ver el detalle.${nextHint}`;
}

function formatMeetingDetail(meeting) {
  const title = getMeetingTitle(meeting);
  const client = getMeetingClient(meeting);
  const date = formatDate(getMeetingDate(meeting));
  const status = getMeetingStatus(meeting);
  const description = getMeetingDescription(meeting);

  return `Reunión\n\nCliente: ${client}\nNombre: ${title}\nFecha: ${date}\nEstado: ${status}\n\nDetalle:\n${description}`;
}

export async function getMeetings({
  query = "",
  limit = 5,
  page = 1,
  detail = false
} = {}) {
  const cleanQuery = String(query || "").trim();
  const result = await fetchMeetingsFromGestor();
  const meetings = result.meetings || [];

  if (!meetings.length) {
    return {
      ok: false,
      intent: "meetings",
      source: "gestor_iso",
      text: `No pude obtener reuniones desde Gestor ISO.\n\nEndpoint probado sin resultado.\n${result.errors?.slice(0, 3).join("\n") || ""}`.trim()
    };
  }

  const activeMeetings = meetings.filter(isActiveMeeting);
  let filtered = activeMeetings;

  if (cleanQuery) {
    filtered = activeMeetings.filter((meeting) => matchesQuery(meeting, cleanQuery));
  }

  if (!filtered.length && cleanQuery) {
    const suggestions = activeMeetings
      .map((meeting) => ({
        meeting,
        score: scoreMeeting(cleanQuery, meeting)
      }))
      .filter((item) => item.score >= 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (suggestions.length) {
      const lines = suggestions.map((item, index) => {
        const title = getMeetingTitle(item.meeting);
        const client = getMeetingClient(item.meeting);
        const date = formatDate(getMeetingDate(item.meeting));

        return `${index + 1}. ${title} — ${client} — ${date}`;
      });

      return {
        ok: true,
        intent: "meetings",
        source: "gestor_iso",
        text: `No encontré reuniones para “${cleanQuery}” exacto.\n\nPosibles coincidencias:\n${lines.join("\n")}\n\nResponde con el número de la opción para ver el detalle.\nO escribe “no” para cancelar.\n\nPrueba:\n/reunion ${getMeetingTitle(suggestions[0].meeting)}`
      };
    }
  }

  if (!filtered.length) {
    return {
      ok: false,
      intent: "meetings",
      source: "gestor_iso",
      text: cleanQuery
        ? `No encontré reuniones para: ${cleanQuery}`
        : "No encontré reuniones activas."
    };
  }

  if (detail || filtered.length === 1) {
    return {
      ok: true,
      intent: "meetings",
      source: "gestor_iso",
      text: formatMeetingDetail(filtered[0])
    };
  }

  return {
    ok: true,
    intent: "meetings",
    source: "gestor_iso",
    text: formatMeetingList(filtered, {
      title: cleanQuery ? `Reuniones · ${cleanQuery}` : "Reuniones activas",
      page,
      limit,
      query: cleanQuery
    })
  };
}
