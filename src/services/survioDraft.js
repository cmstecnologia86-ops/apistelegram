import nodemailer from "nodemailer";
import { gestorIsoRequest } from "./gestorIsoClient.js";

const SURVIO_PLACEHOLDER = "[ENLACE SURVIO AQUÍ]";

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
  return compactText(value)
    .replace(/v/g, "b")
    .replace(/tech/g, "tec")
    .replace(/h/g, "");
}

function boolEnv(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

function formatDateCL(value) {
  if (!value) return "Sin fecha";

  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;

  return text;
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

function candidateStrings(client) {
  return [
    client?.name,
    client?.empresa,
    client?.razon_social,
    client?.rut,
    client?.codigo,
    client?.standard,
    client?.scope,
    client?.address
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function clientScore(client, query) {
  const queryNorm = normalizeText(query);
  const queryCompact = compactText(query);
  const pieces = candidateStrings(client);

  let best = 0;

  for (const piece of pieces) {
    const pNorm = normalizeText(piece);
    const pCompact = compactText(piece);

    if (!pNorm) continue;

    if (pNorm === queryNorm) best = Math.max(best, 1);
    if (pNorm.includes(queryNorm) || queryNorm.includes(pNorm)) best = Math.max(best, 0.94);
    if (pCompact.includes(queryCompact) || queryCompact.includes(pCompact)) best = Math.max(best, 0.9);

    best = Math.max(best, similarity(queryNorm, pNorm));
  }

  return best;
}

function uniqueClients(clients = []) {
  const seen = new Set();

  return clients.filter((client) => {
    const key = [
      client?.id,
      client?.codigo,
      client?.name,
      client?.standard,
      client?.fe_final
    ].map((x) => String(x || "")).join("|");

    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getClientCatalog(query = "") {
  const searchParams = new URLSearchParams();

  if (query) {
    searchParams.set("search", query);
    searchParams.set("limit", "50");
  } else {
    searchParams.set("limit", "500");
  }

  const response = await gestorIsoRequest(`/api/clients?${searchParams.toString()}`);
  const clients = uniqueClients(response?.data?.clients || response?.clients || []);

  if (!query) return clients;

  const bestSearchScore = clients.length
    ? Math.max(...clients.map((client) => clientScore(client, query)))
    : 0;

  if (clients.length && bestSearchScore >= 0.45) {
    return clients;
  }

  const fallbackParams = new URLSearchParams();
  fallbackParams.set("limit", "500");

  const fallbackResponse = await gestorIsoRequest(`/api/clients?${fallbackParams.toString()}`);
  return uniqueClients(fallbackResponse?.data?.clients || fallbackResponse?.clients || []);
}

function getYearFromClient(client) {
  const endDate = firstValue(client.fe_final, client.fecha_final, client.parsed_end_date, client.end_date);
  const match = endDate.match(/^(\d{4})/);
  return match ? match[1] : String(new Date().getFullYear());
}

function buildClientData(client) {
  const standard = firstValue(client.standard, client.norma, client.certification, "Certificación");
  const year = getYearFromClient(client);

  return {
    id: firstValue(client.id),
    empresa: firstValue(client.name, client.empresa, client.razon_social, "Datos cliente"),
    rut: firstValue(client.rut, "Sin RUT"),
    codigo: firstValue(client.codigo, client.code, "Sin código"),
    estado: firstValue(client.status, client.estado, "Sin estado"),
    norma: standard,
    iso: standard,
    fechaInicial: formatDateCL(firstValue(client.fe_inicial, client.fecha_inicial, client.start_date)),
    fechaFinal: formatDateCL(firstValue(client.fe_final, client.fecha_final, client.parsed_end_date, client.end_date)),
    alcance: firstValue(client.scope, client.alcance, "Sin alcance informado"),
    direccion: firstValue(client.address, client.direccion, client.dirección, "Sin dirección informada"),
    year,
    raw: client
  };
}

function optionLine(client, index) {
  const data = buildClientData(client);
  return `${index + 1}. ${data.empresa} — Código ${data.codigo} — ${data.norma} — ${data.estado} — vence ${data.fechaFinal}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildSurvioHtml(data, survioUrl = SURVIO_PLACEHOLDER) {
  const linkText = survioUrl || SURVIO_PLACEHOLDER;

  const cell = "border:1px solid #ffffff;padding:7px 8px;font-size:12px;vertical-align:top;";
  const head = "background:#0f5f7d;color:#ffffff;font-weight:700;text-align:left;";
  const body = "background:#f7fbfd;color:#111111;";
  const highlight = "font-weight:700;color:#111111;";

  return `
<div style="font-family:Arial, Helvetica, sans-serif;color:#111;font-size:14px;line-height:1.45;">
  <p><strong><u>Estimados:</u></strong></p>

  <p>
    Junto con saludar, y conforme al programa de seguimiento de la
    <span style="${highlight}">certificación ${escapeHtml(data.norma)}</span>
    correspondiente al
    <span style="${highlight}">año ${escapeHtml(data.year)}</span>
    de la empresa <span style="${highlight}">${escapeHtml(data.empresa)}</span>,
    informamos lo siguiente:
  </p>

  <table cellspacing="0" cellpadding="0" style="border-collapse:collapse;width:100%;max-width:980px;margin:14px 0;">
    <thead>
      <tr>
        <th style="${cell}${head}">Empresa</th>
        <th style="${cell}${head}">RUT</th>
        <th style="${cell}${head}">Código</th>
        <th style="${cell}${head}">Estado</th>
        <th style="${cell}${head}">Norma</th>
        <th style="${cell}${head}">ISO</th>
        <th style="${cell}${head}">Fecha Inicial</th>
        <th style="${cell}${head}">Fecha Final</th>
        <th style="${cell}${head}">Alcance</th>
        <th style="${cell}${head}">Dirección</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.empresa)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.rut)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.codigo)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.estado)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.norma)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.iso)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.fechaInicial)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.fechaFinal)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.alcance)}</td>
        <td style="${cell}${body}${highlight}">${escapeHtml(data.direccion)}</td>
      </tr>
    </tbody>
  </table>

  <p>En el marco de este proceso de seguimiento:</p>

  <ol>
    <li>
      Se envía la preauditoría <span style="${highlight}">año ${escapeHtml(data.year)}</span>
      para ser respondida en línea:
      <span style="font-size:22px;color:#00a6e7;text-decoration:underline;">${escapeHtml(linkText)}</span>
    </li>
    <li>Se actualiza la información documental habilitante asociada al seguimiento de certificación en la plataforma: https://www.cmscloud.cl</li>
    <li>Se solicita el envío de registros digitales, vía correo electrónico o WhatsApp, relacionados con la autentificación de los procesos y la evidencia de ejecución de sus actividades operacionales.</li>
    <li>Posteriormente, se remitirá el informe autorizado con las observaciones correspondientes.</li>
    <li>Finalmente, se hará envío del certificado respectivo.</li>
  </ol>

  <p>Quedo atento a cualquier consulta o requerimiento adicional.</p>

  <p>Saludos cordiales,</p>

  <p>
    <strong>Carlos Medina Artigas</strong><br>
    Ingeniero de Sistemas de Gestión<br>
    CMS Consultores<br>
    <a href="https://www.cmsconsultores.cl">www.cmsconsultores.cl</a>
  </p>
</div>
`;
}

function buildPlainText(data, survioUrl = SURVIO_PLACEHOLDER) {
  return [
    `BORRADOR SURVIO - ${data.empresa}`,
    "",
    `Asunto sugerido: ${data.empresa} - seguimiento de la certificación ${data.norma}, año ${data.year}`,
    "",
    `Empresa: ${data.empresa}`,
    `RUT: ${data.rut}`,
    `Código: ${data.codigo}`,
    `Estado: ${data.estado}`,
    `Norma: ${data.norma}`,
    `ISO: ${data.iso}`,
    `Fecha Inicial: ${data.fechaInicial}`,
    `Fecha Final: ${data.fechaFinal}`,
    `Alcance: ${data.alcance}`,
    `Dirección: ${data.direccion}`,
    "",
    `Enlace Survio: ${survioUrl || SURVIO_PLACEHOLDER}`
  ].join("\n");
}

function smtpConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  const secure = boolEnv(process.env.SMTP_SECURE, port === 465);
  const from = process.env.SMTP_FROM || user;
  const to = process.env.SURVIO_DRAFT_TO || "cma@cmsconsultores.cl";

  const missing = [];
  if (!host) missing.push("SMTP_HOST");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASSWORD");
  if (!from) missing.push("SMTP_FROM");

  return { host, port, user, pass, secure, from, to, missing };
}

async function sendDraftEmail({ subject, html, text }) {
  const cfg = smtpConfig();

  if (cfg.missing.length) {
    return {
      ok: false,
      error: `Faltan variables SMTP: ${cfg.missing.join(", ")}`
    };
  }

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.pass
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  const info = await transporter.sendMail({
    from: cfg.from,
    to: cfg.to,
    subject,
    html,
    text
  });

  return {
    ok: true,
    to: cfg.to,
    messageId: info.messageId || null
  };
}

export async function getSurvioDraftPreview({ cliente = "" } = {}) {
  const query = String(cliente || "").trim();

  if (!query) {
    return {
      ok: false,
      intent: "survio_draft_preview",
      source: "gestor_iso",
      text: "Debes indicar el cliente. Ejemplo: /survio MEALS"
    };
  }

  const clients = await getClientCatalog(query);

  if (!clients.length) {
    return {
      ok: false,
      intent: "survio_draft_preview",
      source: "gestor_iso",
      text: `No encontré clientes para: ${query}`
    };
  }

  const ranked = clients
    .map((client) => ({
      client,
      score: clientScore(client, query)
    }))
    .filter((item) => item.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const options = (ranked.length ? ranked : clients.slice(0, 5).map((client) => ({ client, score: 0 })))
    .map((item, index) => ({
      index: index + 1,
      score: Number(item.score.toFixed(3)),
      client: buildClientData(item.client)
    }));

  if (!options.length) {
    return {
      ok: false,
      intent: "survio_draft_preview",
      source: "gestor_iso",
      text: `No encontré coincidencias útiles para: ${query}`
    };
  }

  const lines = options.map((option, index) => optionLine(option.client.raw, index));

  return {
    ok: true,
    intent: "survio_draft_preview",
    source: "gestor_iso",
    text: [
      `Encontré estas posibles coincidencias para “${query}”:`,
      "",
      ...lines,
      "",
      "Responde con el número del cliente para generar el borrador Survio.",
      "O escribe “no” para cancelar."
    ].join("\n"),
    meta: {
      query,
      options
    }
  };
}

export async function getSurvioDraftSend({ client = null, clientId = "", cliente = "", survioUrl = "" } = {}) {
  let selectedClient = client;

  if (!selectedClient && clientId) {
    const clients = await getClientCatalog("");
    selectedClient = clients.find((item) => String(item?.id || "") === String(clientId));
  }

  if (!selectedClient && cliente) {
    const preview = await getSurvioDraftPreview({ cliente });
    selectedClient = preview?.meta?.options?.[0]?.client?.raw || null;
  }

  if (!selectedClient || typeof selectedClient !== "object") {
    return {
      ok: false,
      intent: "survio_draft_send",
      source: "gestor_iso_smtp",
      text: "Falta cliente confirmado. Primero ejecuta /tasks/survio-draft-preview."
    };
  }

  const data = buildClientData(selectedClient);
  const subject = `BORRADOR SURVIO - ${data.empresa} - seguimiento ${data.norma} ${data.year}`;
  const html = buildSurvioHtml(data, survioUrl || SURVIO_PLACEHOLDER);
  const text = buildPlainText(data, survioUrl || SURVIO_PLACEHOLDER);

  const sent = await sendDraftEmail({ subject, html, text });

  if (!sent.ok) {
    return {
      ok: false,
      intent: "survio_draft_send",
      source: "gestor_iso_smtp",
      text: `No pude enviar el borrador Survio: ${sent.error}`,
      meta: {
        cliente: data.empresa,
        codigo: data.codigo,
        norma: data.norma
      }
    };
  }

  return {
    ok: true,
    intent: "survio_draft_send",
    source: "gestor_iso_smtp",
    text: [
      "Borrador Survio enviado a tu correo.",
      "",
      `Cliente: ${data.empresa}`,
      `RUT: ${data.rut}`,
      `Código: ${data.codigo}`,
      `Estado: ${data.estado}`,
      `Norma: ${data.norma}`,
      `Vigencia: ${data.fechaInicial} al ${data.fechaFinal}`,
      `Destino: ${sent.to}`,
      "",
      `Enlace editable: ${survioUrl || SURVIO_PLACEHOLDER}`
    ].join("\n"),
    meta: {
      cliente: data.empresa,
      codigo: data.codigo,
      norma: data.norma,
      year: data.year,
      to: sent.to,
      messageId: sent.messageId
    }
  };
}