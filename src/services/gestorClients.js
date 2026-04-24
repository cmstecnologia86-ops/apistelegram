import { gestorIsoRequest } from "./gestorIsoClient.js";

export async function getClientCodes({ clientName = "", limit = 20 } = {}) {
  const query = String(clientName || "").trim();

  if (!query) {
    return {
      ok: false,
      intent: "client_codes",
      text: "Debes indicar el nombre del cliente."
    };
  }

  const params = new URLSearchParams();
  params.set("search", query);
  params.set("limit", String(limit));

  const response = await gestorIsoRequest(`/api/clients?${params.toString()}`);
  const clients = response?.data?.clients || [];

  if (!clients.length) {
    return {
      ok: false,
      intent: "client_codes",
      text: `No encontré certificaciones para: ${query}`
    };
  }

  const companyName = clients[0]?.name || query;
  const lines = clients.map((c) => {
    const code = c.codigo || "sin código";
    const standard = c.standard || "sin certificación";
    return `- ${code} — ${standard}`;
  });

  return {
    ok: true,
    intent: "client_codes",
    source: "gestor_iso",
    text: `${companyName}\n${lines.join("\n")}`
  };
}
