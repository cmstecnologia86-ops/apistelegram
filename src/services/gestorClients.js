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

function candidateNames(client) {
  const name = normalizeText(client?.name || "");
  const parts = name.split(" ").filter(Boolean);
  const candidates = new Set();

  if (name) candidates.add(name);
  if (parts.length) candidates.add(parts[0]);
  if (parts.length >= 2) candidates.add(`${parts[0]} ${parts[1]}`);
  if (client?.rut) candidates.add(String(client.rut));
  if (client?.codigo) candidates.add(String(client.codigo));

  return [...candidates];
}

function uniqueClients(clients = []) {
  const seen = new Set();

  return clients.filter((client) => {
    const key = `${client.name || ""}|${client.codigo || ""}|${client.standard || ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatClientCodes(companyName, clients) {
  const lines = clients.map((c) => {
    const code = c.codigo || "sin código";
    const standard = c.standard || "sin certificación";
    return `- ${code} — ${standard}`;
  });

  return `${companyName}\n${lines.join("\n")}`;
}

function findSimilarClients(query, clients = []) {
  const scored = clients
    .map((client) => {
      const score = Math.max(
        ...candidateNames(client).map((candidate) => similarity(query, candidate))
      );

      return { client, score };
    })
    .filter((item) => item.score >= 0.50)
    .sort((a, b) => b.score - a.score);

  const byName = new Map();

  for (const item of scored) {
    const name = item.client.name || "";
    const key = compactText(name);

    if (!key) continue;

    if (!byName.has(key)) {
      byName.set(key, {
        name,
        score: item.score
      });
    }
  }

  return [...byName.values()].slice(0, 5);
}

export async function getClientCodes({ clientName = "", limit = 20 } = {}) {
  const query = String(clientName || "").trim();

  if (!query) {
    return {
      ok: false,
      intent: "client_codes",
      text: "Debes indicar el cliente. Ejemplo: /codigo MEALS"
    };
  }

  const params = new URLSearchParams();
  params.set("search", query);
  params.set("limit", String(limit));

  const response = await gestorIsoRequest(`/api/clients?${params.toString()}`);
  const clients = uniqueClients(response?.data?.clients || []);

  if (clients.length) {
    const companyName = clients[0]?.name || query;

    return {
      ok: true,
      intent: "client_codes",
      source: "gestor_iso",
      text: formatClientCodes(companyName, clients)
    };
  }

  const allParams = new URLSearchParams();
  allParams.set("limit", "500");

  const allResponse = await gestorIsoRequest(`/api/clients?${allParams.toString()}`);
  const allClients = uniqueClients(allResponse?.data?.clients || []);
  const suggestions = findSimilarClients(query, allClients);

  if (suggestions.length === 1) {
    return {
      ok: true,
      intent: "client_codes",
      source: "gestor_iso",
      text: `No encontré “${query}”.\n\nPosible coincidencia:\n¿Te refieres a “${suggestions[0].name}”?\n\nPrueba:\n/codigo ${suggestions[0].name}`
    };
  }

  if (suggestions.length > 1) {
    const lines = suggestions.map((item, index) => `${index + 1}. ${item.name}`);

    return {
      ok: true,
      intent: "client_codes",
      source: "gestor_iso",
      text: `No encontré “${query}” exacto.\n\nPosibles coincidencias:\n${lines.join("\n")}\n\nPrueba:\n/codigo ${suggestions[0].name}`
    };
  }

  return {
    ok: false,
    intent: "client_codes",
    source: "gestor_iso",
    text: `No encontré certificaciones para: ${query}`
  };
}
