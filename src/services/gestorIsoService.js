const DEFAULT_LIMIT = 20;

function baseUrl() {
  return String(process.env.GESTOR_ISO_BASE_URL || "").replace(/\/+$/, "");
}

export async function gestorIsoFetch(path, options = {}) {
  const url = baseUrl();
  const user = process.env.GESTOR_ISO_USER;
  const password = process.env.GESTOR_ISO_PASSWORD;

  if (!url) throw new Error("Falta GESTOR_ISO_BASE_URL");
  if (!user || !password) throw new Error("Falta credenciales Gestor ISO");

  // login
  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user, password })
  });

  const cookie = loginRes.headers.get("set-cookie");
  if (!loginRes.ok) throw new Error(`Login falló (${loginRes.status})`);

  // request real
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(cookie ? { cookie } : {})
    }
  });

  if (!res.ok) throw new Error(`Gestor ISO ${res.status} en ${path}`);
  return res.json();
}

export async function getActivitiesByStatus({ status = "", limit = DEFAULT_LIMIT } = {}) {
  const s = String(status || "").toLowerCase();

  if (!s) {
    return {
      ok: false,
      intent: "activities_status",
      text: "Debes indicar un estado (ej: en curso, completado)"
    };
  }

  const data = await gestorIsoFetch(`/api/projects`);

  // 👇 aquí está la clave: ajustamos flexible
  const items = (data?.projects || data?.data || [])
    .filter(p => (p.status || "").toLowerCase().includes(s))
    .slice(0, limit);

  if (!items.length) {
    return {
      ok: false,
      intent: "activities_status",
      text: `No hay actividades en estado ${status}`
    };
  }

  const lines = items.map(p => {
    const client = p.client_name || "Sin cliente";
    const title = p.name || p.title || "Sin actividad";
    return `- ${client} — ${title}`;
  });

  return {
    ok: true,
    intent: "activities_status",
    text: `Actividades ${status}\n\n${lines.join("\n")}`
  };
}
