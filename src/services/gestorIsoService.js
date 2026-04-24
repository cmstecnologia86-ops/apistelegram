const DEFAULT_LIMIT = 10;

function baseUrl() {
  return String(process.env.GESTOR_ISO_BASE_URL || "").replace(/\/+$/, "");
}

export async function gestorIsoFetch(path, options = {}) {
  const url = baseUrl();
  const user = process.env.GESTOR_ISO_USER;
  const password = process.env.GESTOR_ISO_PASSWORD;

  if (!url) throw new Error("Falta GESTOR_ISO_BASE_URL");
  if (!user || !password) throw new Error("Falta GESTOR_ISO_USER o GESTOR_ISO_PASSWORD");

  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user, password })
  });

  const cookie = loginRes.headers.get("set-cookie");
  if (!loginRes.ok) throw new Error(`Login Gestor ISO falló: ${loginRes.status}`);

  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(cookie ? { cookie } : {})
    }
  });

  if (!res.ok) throw new Error(`Gestor ISO respondió ${res.status} en ${path}`);
  return res.json();
}

export async function getGestorClients({ limit = DEFAULT_LIMIT, onlyAlerts = false, search = "" } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (onlyAlerts) params.set("only_alerts", "1");
  if (search) params.set("search", search);

  const data = await gestorIsoFetch(`/api/clients?${params.toString()}`);

  return {
    ok: true,
    intent: "gestor_clients",
    source: "gestor_iso",
    text: "Clientes obtenidos desde Gestor ISO.",
    data
  };
}

export async function getClientCodes({ clientName = "", limit = 20 } = {}) {
  const query = String(clientName || "").trim();
  if (!query) {
    return {
      ok: false,
      intent: "client_codes",
      source: "gestor_iso",
      text: "Debes indicar el nombre del cliente."
    };
  }

  const result = await getGestorClients({ limit, search: query });
  const clients = result?.data?.data?.clients || [];

  if (!clients.length) {
    return {
      ok: false,
      intent: "client_codes",
      source: "gestor_iso",
      text: `No encontré certificaciones para: ${query}`,
      data: { query, clients: [] }
    };
  }

  const lines = clients.map((c) => {
    const code = c.codigo || "sin código";
    const standard = c.standard || "sin norma";

    return `- ${code} — ${standard}`;
  });

  const firstName = clients[0]?.name || query;

  return {
    ok: true,
    intent: "client_codes",
    source: "gestor_iso",
    text: `${firstName}\n${lines.join("\n")}`,
    data: {
      query,
      count: clients.length,
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        codigo: c.codigo,
        standard: c.standard,
        scope: c.scope,
        status: c.status,
        fe_final: c.fe_final,
        days_remaining: c.days_remaining
      }))
    }
  };
}

export async function getActivitiesByPriority({ priority = "high", limit = 20 } = {}) {
  

  const p = String(priority || "").toLowerCase();

  const data = await gestorIsoFetch(`/api/workspace/summary`);

  const items = (data?.workspace?.activities || data?.data?.activities || []).filter(a => (a.status || "").toLowerCase().includes(p)).slice(0, limit);

  if (!items.length) {
    return {
      ok: false,
      intent: "activities_priority",
      text: `No hay actividades con prioridad ${priority}`
    };
  }

  const lines = items.map(a => {
    const client = a.client_name || "Sin cliente";
    const title = a.title || "Sin actividad";
    return `- ${client} — ${title}`;
  });

  const label = priority.toUpperCase();

  return {
    ok: true,
    intent: "activities_priority",
    text: `🔴 Actividades ${lines.join("\n")}`
  };
}




