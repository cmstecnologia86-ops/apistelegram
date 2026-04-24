import express from "express";
import dotenv from "dotenv";
import healthRouter from "./routes/health.js";
import tasksRouter from "./routes/tasks.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3011);
const BIND = process.env.TASK_API_BIND || "127.0.0.1";

app.use(express.json());
app.use("/health", healthRouter);
app.use("/tasks", tasksRouter);

app.use((req, res) => {
  return res.status(404).json({ ok: false, text: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, BIND, () => {
  console.log(`openclaw-task-api listening on http://${BIND}:${PORT}`);
});

