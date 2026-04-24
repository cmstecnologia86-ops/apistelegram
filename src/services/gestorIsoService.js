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
