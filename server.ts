import express from "express";
import path from "path";
import { config } from "dotenv";

// Load environment variables
config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Healthcheck endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "sistema ebc-ac-usa" });
});

// Asaas sync endpoint
app.post("/api/asaas/sync-client-status", (req, res) => {
  res.json({
    success: true,
    found: false,
    setupPaymentStatus: "pending",
    monthlyPaymentStatus: "pending",
    details: ["Modo autônomo ativo. Os status de pagamento podem ser gerenciados diretamente no painel administrativo."]
  });
});

// Setup Vite or Static File Serving for local/container dev
async function startServer() {
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (vErr: any) {
        console.warn("Vite middleware error:", vErr.message);
      }
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[EBC-AC-USA] Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

startServer();

export default app;
