import express from "express";
import { gestorIsoRequest } from "../services/gestorIsoClient.js";
import { getClientCodes } from "../services/gestorClients.js";
import { getClientsExpiringFromGestor } from "../services/gestorExpirations.js";
import { getActivitiesByStatus } from "../services/gestorActivities.js";
import { getMeetings } from "../services/gestorMeetings.js";
import { getProjects } from "../services/gestorProjects.js";
import { getProjectDetail } from "../services/gestorProjectDetail.js";
import { getProjectStageStatus } from "../services/gestorProjectStageStatus.js";

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

router.post("/activities-status", async (req, res) => {
  try {
    const result = await getActivitiesByStatus({
      status: req.body?.status || req.body?.estado || "",
      clientName: req.body?.client_name || req.body?.cliente || req.body?.client || "",
      limit: req.body?.limit || (req.body?.client_name || req.body?.cliente || req.body?.client ? 10 : 5),
      page: req.body?.page || req.body?.pagina || 1
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "activities_status",
      text: "No pude obtener actividades.",
      error: error.message
    });
  }
});


router.post("/meetings", async (req, res) => {
  try {
    const result = await getMeetings({
      query: req.body?.query || req.body?.client_name || req.body?.cliente || req.body?.search || "",
      limit: req.body?.limit || 5,
      page: req.body?.page || req.body?.pagina || 1,
      detail: req.body?.detail || false
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "meetings",
      text: "No pude obtener reuniones.",
      error: error.message
    });
  }
});

router.post("/projects", async (req, res) => {
  try {
    const result = await getProjects({
      query: req.body?.query || req.body?.client_name || req.body?.cliente || req.body?.search || "",
      limit: req.body?.limit || 5,
      page: req.body?.page || req.body?.pagina || 1,
      detail: req.body?.detail || false,
      includeCompleted: req.body?.include_completed ?? req.body?.includeCompleted ?? true
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "projects",
      text: "No pude obtener proyectos.",
      error: error.message
    });
  }
});

router.post("/project-detail", async (req, res) => {
  try {
    const result = await getProjectDetail({
      query: req.body?.query || req.body?.project || req.body?.proyecto || req.body?.search || "",
      stage: req.body?.stage || req.body?.etapa || null
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "project_detail",
      text: "No pude obtener el detalle del proyecto.",
      error: error.message
    });
  }
});
router.post("/project-stage-status", async (req, res) => {
  try {
    const result = await getProjectStageStatus({
      query: req.body?.query || req.body?.project || req.body?.proyecto || req.body?.search || "",
      stage: req.body?.stage || req.body?.etapa || null,
      status: req.body?.status || req.body?.estado || "",
      confirm: req.body?.confirm === true || req.body?.confirmar === true
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});
export default router;






