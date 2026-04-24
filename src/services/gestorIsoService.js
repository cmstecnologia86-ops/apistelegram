const DEFAULT_LIMIT = 20;

function baseUrl() {
  return String(process.env.GESTOR_ISO_BASE_URL || "").replace(/\/+$/, "");
}

export async function gestorIsoFetch(path) {
  const url = baseUrl();
  const user = process.env.GESTOR_ISO_USER;
  const password = process.env.GESTOR_ISO_PASSWORD;

  if (!url) throw new Error("Falta GESTOR_ISO_BASE_URL");
  if (!user || !password) throw new Error("Faltan credenciales");

  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user, password })
  });

  const cookie = loginRes.headers.get("set-cookie");

  if (!loginRes.ok) {
    const txt = await loginRes.text();
    throw new Error(`Login error ${loginRes.status}: ${txt}`);
  }

  const res = await fetch(`${url}${path}`, {
    headers: cookie ? { cookie } : {}
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`API error ${res.status}: ${txt}`);
  }

  return res.json();
}

export async function getActivitiesByStatus({ status = "", limit = DEFAULT_LIMIT } = {}) {
  try {
    const s = String(status || "").toLowerCase();

    if (!s) {
      return {
        ok: false,
        text: "Debes indicar estado (ej: en curso, completado)"
      };
    }

    const data = await gestorIsoFetch(`/api/projects`);

    // 🔥 mostramos estructura real en logs
    console.log("RAW:", JSON.stringify(data).slice(0, 1000));

    // 🔥 fallback robusto
    let list = [];

    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data.projects)) list = data.projects;
    else if (Array.isArray(data.data)) list = data.data;
    else if (Array.isArray(data.items)) list = data.items;

    const filtered = list
      .filter(p => String(p?.status || p?.status_name || "").toLowerCase().includes(s))
      .slice(0, limit);

    if (!filtered.length) {
      return {
        ok: false,
        text: `No hay actividades en estado ${status}`
      };
    }

    const lines = filtered.map(p => {
      const client = p.client_name || p.client || "Sin cliente";
      const title = p.name || p.title || "Sin actividad";
      return `- ${client} — ${title}`;
    });

    return {
      ok: true,
      text: `Actividades ${status}\n\n${lines.join("\n")}`
    };

  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}
