import express from "express";
import { gestorIsoRequest } from "../services/gestorIsoClient.js";

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

export default router;
