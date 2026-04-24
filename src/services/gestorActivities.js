import { gestorIsoRequest } from "./gestorIsoClient.js";

function normalizeStatus(input = "") {
  const raw = String(input || "").trim().toLowerCase();

  const map = {
    "borrador": "draft",
    "draft": "draft",

    "en curso": "in_progress",
    "curso": "in_progress",
    "in_progress": "in_progress",
    "in progress": "in_progress",

    "en revision": "in_review",
    "en revisión": "in_review",
    "revision": "in_review",
    "revisión": "in_review",
    "in_review": "in_review",

    "en espera": "on_hold",
    "espera": "on_hold",
    "on_hold": "on_hold",

    "completado": "completed",
    "completada": "completed",
    "completadas": "completed",
    "completados": "completed",
    "completed": "completed",

    "cancelado": "cancelled",
    "cancelada": "cancelled",
    "cancelled": "cancelled"
  };

  return map[raw] || raw;
}

function shortText(value = "", max = 90) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "Sin descripción.";
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function statusLabel(status) {
  const labels = {
    draft: "borrador",
    in_progress: "en curso",
    in_review: "en revisión",
    on_hold: "en espera",
    completed: "completado",
    cancelled: "cancelado"
  };

  return labels[status] || status;
}

export async function getActivitiesByStatus({ status = "en curso", limit = 20 } = {}) {
  const normalizedStatus = normalizeStatus(status);

  const params = new URLSearchParams();
  params.set("status", normalizedStatus);
  params.set("limit", String(limit));

  const response = await gestorIsoRequest(`/api/projects?${params.toString()}`);
  const projects = response?.data?.projects || [];

  if (!projects.length) {
    return {
      ok: false,
      intent: "activities_status",
      source: "gestor_iso",
      text: `No encontré actividades en estado ${status}.`
    };
  }

  const lines = projects.map((p) => {
    const client = p.client_name || "Sin cliente";
    const title = p.name || p.title || "Sin actividad";
    const description = shortText(p.description || p.notes || "");
    return `- ${client} — ${title}: ${description}`;
  });

  return {
    ok: true,
    intent: "activities_status",
    source: "gestor_iso",
    text: `Actividades ${statusLabel(normalizedStatus)}\n\n${lines.join("\n")}`
  };
}
