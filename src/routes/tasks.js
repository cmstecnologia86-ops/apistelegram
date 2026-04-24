import express from "express";
import { gestorIsoRequest } from "../services/gestorIsoClient.js";
import { getClientCodes } from "../services/gestorClients.js";
import { getClientsExpiringFromGestor } from "../services/gestorExpirations.js";

const router = express.Router();

router.post("/gestor-test", async (_req, res) => {
  try {
    const data = await gestorIsoRequest("/api/clients?limit=1");

    return res.json({
      ok: true,
      test: "conexion ok",
      sample: data
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      test: "conexion error",
      error: error.message
    });
  }
});

router.post("/client-codes", async (req, res) => {
  try {
    const result = await getClientCodes({
      clientName: req.body?.client_name || req.body?.cliente || req.body?.query || "",
      limit: req.body?.limit || 20
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "client_codes",
      text: "No pude obtener los códigos del cliente.",
      error: error.message
    });
  }
});

router.post("/clients-expiring", async (req, res) => {
  try {
    const result = await getClientsExpiringFromGestor({
      days: req.body?.days || 30,
      limit: req.body?.limit || 20
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "clients_expiring",
      text: "No pude obtener clientes vencidos o por vencer.",
      error: error.message
    });
  }
});

export default router;
