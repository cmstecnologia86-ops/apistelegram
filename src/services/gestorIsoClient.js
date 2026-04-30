function baseUrl() {
  return String(process.env.GESTOR_ISO_BASE_URL || "").replace(/\/+$/, "");
}

export async function gestorIsoRequest(path, options = {}) {
  const url = baseUrl();
  const user = process.env.GESTOR_ISO_USER;
  const password = process.env.GESTOR_ISO_PASSWORD;

  if (!url) throw new Error("Falta GESTOR_ISO_BASE_URL");
  if (!user || !password) throw new Error("Faltan credenciales Gestor ISO");

  const loginRes = await fetch(`${url}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user, password })
  });

  const cookie = loginRes.headers.get("set-cookie");

  if (!loginRes.ok) {
    const text = await loginRes.text();
    throw new Error(`Login Gestor ISO falló ${loginRes.status}: ${text.slice(0, 200)}`);
  }

  const method = options.method || "GET";
  const headers = {
    ...(cookie ? { cookie } : {}),
    ...(options.body ? { "content-type": "application/json" } : {})
  };

  const res = await fetch(`${url}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gestor ISO respondió ${res.status} en ${path}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

