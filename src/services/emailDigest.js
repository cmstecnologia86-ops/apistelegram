import { ImapFlow } from "imapflow";

const DEFAULT_MODEL = "gpt-5-nano";

function boolEnv(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
}

function numberEnv(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanText(value, max = 240) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function formatDateCL(value) {
  if (!value) return "Sin fecha";

  try {
    return new Intl.DateTimeFormat("es-CL", {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function buildSender(envelope) {
  const from = envelope?.from?.[0];
  if (!from) return "Remitente no informado";

  const name = cleanText(from.name || "", 80);
  const address = cleanText(from.address || "", 120);

  if (name && address) return `${name} <${address}>`;
  return name || address || "Remitente no informado";
}

function getEnvConfig() {
  const host = process.env.IMAP_HOST;
  const port = numberEnv(process.env.IMAP_PORT, 993);
  const user = process.env.IMAP_USER;
  const password = process.env.IMAP_PASSWORD;
  const mailbox = process.env.IMAP_MAILBOX || "INBOX";
  const starttls = boolEnv(process.env.IMAP_STARTTLS, port === 143);
  const secure = boolEnv(process.env.IMAP_SECURE, port === 993 && !starttls);

  const missing = [];
  if (!host) missing.push("IMAP_HOST");
  if (!user) missing.push("IMAP_USER");
  if (!password) missing.push("IMAP_PASSWORD");

  return {
    ok: missing.length === 0,
    missing,
    host,
    port,
    user,
    password,
    mailbox,
    starttls,
    secure
  };
}

async function fetchRecentEmails({ hours = 48, limit = 40 } = {}) {
  const cfg = getEnvConfig();

  if (!cfg.ok) {
    return {
      ok: false,
      error: `Faltan variables de correo: ${cfg.missing.join(", ")}`
    };
  }

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: {
      user: cfg.user,
      pass: cfg.password
    },
    tls: {
      rejectUnauthorized: false
    },
    logger: false
  });

  const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000);
  const emails = [];

  await client.connect();

  let lock;
  try {
    if (cfg.starttls && !cfg.secure && typeof client.startTLS === "function") {
      // ImapFlow suele negociar STARTTLS automÃ¡ticamente segÃºn servidor/capabilities.
      // Se deja defensivo para no romper proveedores que ya lo gestionan.
    }

    lock = await client.getMailboxLock(cfg.mailbox);

    const uids = await client.search({ since }, { uid: true });
    const selectedUids = Array.isArray(uids)
      ? uids.slice(-Math.max(1, Number(limit)))
      : [];

    if (selectedUids.length === 0) {
      return {
        ok: true,
        emails: [],
        total: 0,
        unread: 0,
        since,
        account: cfg.user
      };
    }

    for await (const message of client.fetch(selectedUids, {
      uid: true,
      envelope: true,
      flags: true
    }, { uid: true })) {
      const flags = Array.from(message.flags || []);
      const seen = flags.includes("\\Seen");

      emails.push({
        uid: message.uid,
        from: buildSender(message.envelope),
        subject: cleanText(message.envelope?.subject || "(Sin asunto)", 180),
        receivedAt: message.envelope?.date ? new Date(message.envelope.date).toISOString() : null,
        seen,
        unread: !seen
      });
    }
  } finally {
    if (lock) lock.release();
    await client.logout().catch(() => {});
  }

  emails.sort((a, b) => new Date(b.receivedAt || 0) - new Date(a.receivedAt || 0));

  return {
    ok: true,
    emails,
    total: emails.length,
    unread: emails.filter((mail) => mail.unread).length,
    since,
    account: cfg.user
  };
}

function buildFallbackText({ hours, account, emails, total, unread }) {
  const lines = [];
  lines.push(`Resumen de correos de las últimas ${hours} horas`);
  lines.push("");
  lines.push(`Cuenta: ${account || "No informada"}`);
  lines.push(`Correos encontrados: ${total}`);
  lines.push(`No leídos: ${unread}`);
  lines.push("");

  if (!emails.length) {
    lines.push("No se encontraron correos en el rango solicitado.");
    return lines.join("\n");
  }

  lines.push("Últimos correos:");
  emails.slice(0, 12).forEach((mail, index) => {
    lines.push(`${index + 1}. ${mail.subject}`);
    lines.push(`   De: ${mail.from}`);
    lines.push(`   Fecha: ${formatDateCL(mail.receivedAt)}`);
    lines.push(`   Estado: ${mail.unread ? "No leído" : "LeÃ­do"}`);
  });

  return lines.join("\n");
}

async function summarizeWithOpenAI({ hours, account, emails, total, unread }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return buildFallbackText({ hours, account, emails, total, unread });
  }

  const model = process.env.OPENAI_EMAIL_DIGEST_MODEL || process.env.OPENAI_MODEL || DEFAULT_MODEL;

  const compactEmails = emails.slice(0, 40).map((mail, index) => ({
    n: index + 1,
    from: mail.from,
    subject: mail.subject,
    receivedAt: formatDateCL(mail.receivedAt),
    unread: mail.unread
  }));

  const prompt = [
    `Genera un resumen ejecutivo en español de los correos recibidos en las últimas ${hours} horas.`,
    "Contexto: el usuario es CMS Consultores y necesita saber quÃ© pasÃ³, quÃ© es importante y quÃ© deberÃ­a responder o revisar.",
    "",
    `Cuenta: ${account}`,
    `Total encontrados: ${total}`,
    `No leídos: ${unread}`,
    "",
    "Correos:",
    JSON.stringify(compactEmails, null, 2),
    "",
    "Formato requerido:",
    "Resumen de correos de las últimas X horas",
    "1) Panorama general",
    "2) Correos importantes o de clientes",
    "3) Alertas / plataformas / sistemas",
    "4) Pendientes sugeridos",
    "",
    "SÃ© concreto. No inventes datos. Si no hay correos suficientes, dilo."
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input: prompt
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    return [
      buildFallbackText({ hours, account, emails, total, unread }),
      "",
      `Nota: no se pudo resumir con OpenAI (${response.status}).`,
      errorText ? errorText.slice(0, 300) : ""
    ].filter(Boolean).join("\n");
  }

  const data = await response.json();
  const text =
    data.output_text ||
    data.output?.flatMap((item) => item.content || [])
      ?.map((part) => part.text || "")
      ?.join("")
      ?.trim();

  return text || buildFallbackText({ hours, account, emails, total, unread });
}

export async function getEmailDigest(options = {}) {
  const hoursRaw = options.hours ?? 48;
  const hours = Math.max(1, Math.min(Number(hoursRaw) || 48, 168));
  const limit = Math.max(5, Math.min(Number(options.limit) || 40, 80));

  try {
    const result = await fetchRecentEmails({ hours, limit });

    if (!result.ok) {
      return {
        ok: false,
        intent: "email_digest",
        source: "imap",
        text: `No pude revisar el correo: ${result.error}`,
        error: result.error
      };
    }

    const text = await summarizeWithOpenAI({
      hours,
      account: result.account,
      emails: result.emails,
      total: result.total,
      unread: result.unread
    });

    return {
      ok: true,
      intent: "email_digest",
      source: "imap_openai",
      text,
      meta: {
        hours,
        account: result.account,
        total: result.total,
        unread: result.unread,
        limit,
        since: result.since
      }
    };
  } catch (error) {
    return {
      ok: false,
      intent: "email_digest",
      source: "imap_openai",
      text: `Error al revisar correos: ${error.message}`,
      error: error.message
    };
  }
}

