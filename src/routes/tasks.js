import express from "express";
import { gestorIsoRequest } from "../services/gestorIsoClient.js";
import { getClientCodes } from "../services/gestorClients.js";
import { getClientsExpiringFromGestor } from "../services/gestorExpirations.js";
import { getActivitiesByStatus } from "../services/gestorActivities.js";
import { getMeetings } from "../services/gestorMeetings.js";
import { getProjects } from "../services/gestorProjects.js";
import { getProjectDetail } from "../services/gestorProjectDetail.js";
import { getProjectStageStatus } from "../services/gestorProjectStageStatus.js";
import { getProjectStageProgress } from "../services/gestorProjectStageProgress.js";
import { getProjectStageDates } from "../services/gestorProjectStageDates.js";
import { getProjectNewDraft, getProjectNewCreate } from "../services/gestorProjectNew.js";

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
router.post("/project-stage-progress", async (req, res) => {
  try {
    const result = await getProjectStageProgress({
      query: req.body?.query || req.body?.project || req.body?.proyecto || req.body?.search || "",
      stage: req.body?.stage || req.body?.etapa || null,
      progress: req.body?.progress ?? req.body?.avance ?? req.body?.percent ?? null,
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

router.post("/project-stage-dates", async (req, res) => {
  try {
    const result = await getProjectStageDates({
      query: req.body?.query || req.body?.project || req.body?.proyecto || req.body?.search || "",
      stage: req.body?.stage || req.body?.etapa || null,
      startDate: req.body?.start_date || req.body?.startDate || req.body?.inicio || "",
      endDate: req.body?.end_date || req.body?.endDate || req.body?.termino || req.body?.término || req.body?.fin || "",
      rawDateText: req.body?.raw || req.body?.texto || "",
      confirm: req.body?.confirm === true || req.body?.confirm === "true"
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "project_stage_dates",
      source: "gestor_iso",
      text: `Error al editar fechas de etapa: ${error.message}`
    });
  }
});

router.post("/project-new-draft", async (req, res) => {
  try {
    const result = await getProjectNewDraft({
      prompt: req.body?.prompt || req.body?.contexto || req.body?.context || req.body?.query || ""
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "project_new_draft",
      source: "gestor_iso",
      text: `Error al generar borrador de proyecto: ${error.message}`
    });
  }
});


router.post("/project-new-create", async (req, res) => {
  try {
    const result = await getProjectNewCreate({
      draft: req.body?.draft || req.body?.payload || null,
      confirm: req.body?.confirm === true || req.body?.confirm === "true"
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "project_new_create",
      source: "gestor_iso",
      text: `Error al crear proyecto Gantt: ${error.message}`
    });
  }
});

router.post("/activity-new-draft", async (req, res) => {
  try {
    const result = await getActivityNewDraft({
      prompt: req.body?.prompt || req.body?.contexto || req.body?.context || req.body?.query || ""
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "activity_new_draft",
      source: "gestor_iso",
      text: `Error al generar borrador de actividad: ${error.message}`
    });
  }
});

router.post("/activity-new-create", async (req, res) => {
  try {
    const result = await getActivityNewCreate({
      draft: req.body?.draft || req.body?.payload || null,
      confirm: req.body?.confirm === true || req.body?.confirm === "true"
    });

    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "activity_new_create",
      source: "gestor_iso",
      text: `Error al crear actividad: ${error.message}`
    });
  }
});

export default router;











