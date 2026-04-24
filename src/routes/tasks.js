import express from "express";
import { getSummary } from "../services/summaryService.js";
import { getClients, getClientsExpiring, getClientExpiryByName } from "../services/clientsService.js";
import { getProjects, searchProject } from "../services/projectsService.js";
import { getMeetings } from "../services/meetingsService.js";
import { getActivities } from "../services/activitiesService.js";
import { getGantt } from "../services/ganttService.js";
import { getGestorClients, getClientCodes, getActivitiesByStatus } from "../services/gestorIsoService.js";

const router = express.Router();

router.post("/summary", async (_req, res) => {
  try { return res.json(await getSummary()); } catch (error) { return res.status(500).json({ ok: false, intent: "summary", text: "No pude generar el resumen.", error: error.message }); }
});

router.post("/clients", async (req, res) => {
  try { return res.json(await getClients({ limit: req.body?.limit, activeOnly: req.body?.active_only === true })); } catch (error) { return res.status(500).json({ ok: false, intent: "clients_list", text: "No pude revisar clientes.", error: error.message }); }
});

router.post("/clients-expiring", async (req, res) => {
  try { return res.json(await getClientsExpiring({ days: req.body?.days, limit: req.body?.limit })); } catch (error) { return res.status(500).json({ ok: false, intent: "clients_expiring", text: "No pude revisar vencimientos.", error: error.message }); }
});

router.post("/client-expiry", async (req, res) => {
  try {
    const result = await getClientExpiryByName({ clientName: req.body?.client_name });
    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, intent: "client_expiry", text: "No pude revisar el vencimiento del cliente.", error: error.message });
  }
});

router.post("/projects", async (req, res) => {
  try { return res.json(await getProjects({ limit: req.body?.limit, activeOnly: req.body?.active_only === true })); } catch (error) { return res.status(500).json({ ok: false, intent: "projects_list", text: "No pude revisar proyectos.", error: error.message }); }
});

router.post("/project-search", async (req, res) => {
  try {
    const result = await searchProject({ query: req.body?.query });
    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, intent: "project_search", text: "No pude buscar el proyecto.", error: error.message });
  }
});

router.post("/meetings", async (req, res) => {
  try { return res.json(await getMeetings({ mode: req.body?.mode, days: req.body?.days, limit: req.body?.limit })); } catch (error) { return res.status(500).json({ ok: false, intent: "meetings", text: "No pude revisar reuniones.", error: error.message }); }
});

router.post("/activities", async (req, res) => {
  try { return res.json(await getActivities({ mode: req.body?.mode, days: req.body?.days, limit: req.body?.limit })); } catch (error) { return res.status(500).json({ ok: false, intent: "activities", text: "No pude revisar actividades.", error: error.message }); }
});

router.post("/gantt", async (req, res) => {
  try { return res.json(await getGantt({ mode: req.body?.mode, limit: req.body?.limit })); } catch (error) { return res.status(500).json({ ok: false, intent: "gantt", text: "No pude revisar gantt.", error: error.message }); }
});


router.post("/gestor-clients", async (req, res) => {
  try {
    return res.json(await getGestorClients({
      limit: req.body?.limit,
      onlyAlerts: req.body?.only_alerts === true,
      search: req.body?.search || ""
    }));
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "gestor_clients",
      source: "gestor_iso",
      text: "No pude obtener clientes desde Gestor ISO.",
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
      source: "gestor_iso",
      text: "No pude obtener los códigos del cliente.",
      error: error.message
    });
  }
});

router.post("/activities-priority", async (req, res) => {
  try {
    const result = await getActivitiesByStatus({
      status: req.body?.priority || "en curso",
      limit: req.body?.limit || 20
    });
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      intent: "activities_priority",
      text: "No pude obtener actividades.",
      error: error.message
    });
  }
});
export default router;





