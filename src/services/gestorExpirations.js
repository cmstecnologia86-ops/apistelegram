import { gestorIsoRequest } from "./gestorIsoClient.js";

function formatDays(days) {
  const n = Number(days);
  if (Number.isNaN(n)) return "sin días calculados";
  if (n < 0) return `venció hace ${Math.abs(n)} día(s)`;
  if (n === 0) return "vence hoy";
  return `vence en ${n} día(s)`;
}

export async function getClientsExpiringFromGestor({ days = 30, limit = 20 } = {}) {
  const params = new URLSearchParams();
  params.set("only_alerts", "1");
  params.set("limit", String(limit));

  const response = await gestorIsoRequest(`/api/clients?${params.toString()}`);
  const clients = response?.data?.clients || [];

  const maxDays = Number(days);
  const filtered = clients
    .filter((c) => {
      const d = Number(c.days_remaining);
      if (Number.isNaN(d)) return false;
      return d <= maxDays;
    })
    .slice(0, Number(limit) || 20);

  if (!filtered.length) {
    return {
      ok: false,
      intent: "clients_expiring",
      source: "gestor_iso",
      text: `No encontré clientes vencidos o por vencer en ${days} día(s).`
    };
  }

  const expired = filtered.filter((c) => Number(c.days_remaining) < 0);
  const upcoming = filtered.filter((c) => Number(c.days_remaining) >= 0);

  const line = (c) => {
    const name = c.name || "Sin nombre";
    const standard = c.standard || "sin certificación";
    const code = c.codigo || "sin código";
    return `- ${name} — ${standard} — código ${code} — ${formatDays(c.days_remaining)}`;
  };

  const blocks = ["Clientes vencidos / por vencer"];

  if (expired.length) {
    blocks.push("");
    blocks.push("🔴 Vencidos");
    blocks.push(...expired.map(line));
  }

  if (upcoming.length) {
    blocks.push("");
    blocks.push("🟠 Próximos");
    blocks.push(...upcoming.map(line));
  }

  return {
    ok: true,
    intent: "clients_expiring",
    source: "gestor_iso",
    text: blocks.join("\n")
  };
}
