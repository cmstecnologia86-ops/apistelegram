import express from "express";
import { pingDb } from "../services/db.js";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    await pingDb();
    return res.json({ ok: true, service: "openclaw-task-api", db: "ok" });
  } catch (error) {
    return res.status(500).json({ ok: false, service: "openclaw-task-api", db: "error", error: error.message });
  }
});

export default router;
