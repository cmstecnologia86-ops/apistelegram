import { getClients } from "./clientsService.js";
import { getClientsExpiring } from "./clientsService.js";
import { getProjects } from "./projectsService.js";
import { getMeetings } from "./meetingsService.js";
import { getActivities } from "./activitiesService.js";
import { getGantt } from "./ganttService.js";

export async function getSummary() {
  const [clients, expiring, projects, meetings, activities, gantt] = await Promise.all([
    getClients({ limit: 5, activeOnly: true }),
    getClientsExpiring({ days: 60, limit: 5 }),
    getProjects({ limit: 5, activeOnly: true }),
    getMeetings({ mode: "today", limit: 5 }),
    getActivities({ mode: "today", limit: 5 }),
    getGantt({ mode: "week", limit: 5 })
  ]);

  const text = [
    "Resumen general",
    "",
    `Clientes activos: ${clients.data?.total ?? 0}`,
    `Vencen pronto: ${expiring.data?.total ?? 0}`,
    `Proyectos activos: ${projects.data?.total ?? 0}`,
    `Reuniones hoy: ${meetings.data?.total ?? 0}`,
    `Actividades hoy: ${activities.data?.total ?? 0}`,
    `Hitos gantt próximos: ${gantt.data?.total ?? 0}`
  ].join("\n");

  return {
    ok: true,
    intent: "summary",
    text,
    data: {
      clients: clients.data?.total ?? 0,
      expiring: expiring.data?.total ?? 0,
      projects: projects.data?.total ?? 0,
      meetings: meetings.data?.total ?? 0,
      activities: activities.data?.total ?? 0,
      gantt: gantt.data?.total ?? 0
    }
  };
}
