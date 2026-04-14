# openclaw-task-api

API de tareas para OpenClaw orientada a Telegram.

## Flujo

```text
Telegram -> OpenClaw -> openclaw-task-api -> Gestor ISO / BD -> respuesta lista para Telegram
```

## Tareas incluidas en esta v1

- Salud del servicio
- Resumen general
- Clientes activos
- Clientes por vencer
- Vencimiento por cliente
- Proyectos activos
- Reuniones recientes / hoy / semana
- Actividades recientes / hoy / semana
- Gantt resumido / próximos hitos

## Comandos de Telegram sugeridos

### Clientes
- `/clientes`
- `/activos`
- `/vencimientos`
- `/vencimientos 30`
- `/vencimientos 60`
- `/vencimiento Geobarra`
- `/cliente Geobarra`

### Proyectos
- `/proyectos`
- `/proyectos activos`
- `/proyecto CODIGO_O_NOMBRE`

### Reuniones
- `/reuniones`
- `/reuniones hoy`
- `/reuniones semana`
- `/reuniones 7`

### Actividades
- `/actividades`
- `/actividades hoy`
- `/actividades semana`
- `/actividades 7`

### Gantt
- `/gantt`
- `/gantt activos`
- `/gantt hoy`
- `/gantt semana`

### Resumen
- `/resumen`

## Endpoints

- `GET /health`
- `POST /tasks/summary`
- `POST /tasks/clients`
- `POST /tasks/clients-expiring`
- `POST /tasks/client-expiry`
- `POST /tasks/projects`
- `POST /tasks/project-search`
- `POST /tasks/meetings`
- `POST /tasks/activities`
- `POST /tasks/gantt`

## Importante

Este pack trae una base funcional y modular, pero las consultas SQL usan nombres de tablas y columnas asumidos. Antes de usar en producción debes ajustar los servicios a tu esquema real.

Supuestos base usados aquí:

- `certification_records`
- `projects`
- `meetings`
- `activities`
- `gantt_items`

## Instalación rápida

```bash
cp .env.example .env
npm install
npm start
```

## Validación rápida

```bash
curl -s http://127.0.0.1:3011/health
curl -s -X POST http://127.0.0.1:3011/tasks/summary -H "Content-Type: application/json" -d '{}'
```
