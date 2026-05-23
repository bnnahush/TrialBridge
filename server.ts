import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Body parsing middleware
  app.use(express.json());
  app.use(express.text({ type: ["application/fhir+json", "application/json", "text/*"] }));

  // CORS headers middleware
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Host info configurations
  app.get("/api/config", (req, res) => {
    res.json({
      fhirBaseUrlConfigured: !!process.env.FHIR_BASE_URL,
      fhirBaseUrl: process.env.FHIR_BASE_URL ? process.env.FHIR_BASE_URL.replace(/\/$/, "") : "https://hapi.fhir.org/baseR4",
      hasBearerToken: !!process.env.FHIR_BEARER_TOKEN,
    });
  });

  // ALL /fhir-proxy/* route
  app.all("/fhir-proxy/*", async (req, res) => {
    const rawFhirlUrl = process.env.FHIR_BASE_URL || "https://hapi.fhir.org/baseR4";
    const baseUrl = rawFhirlUrl.replace(/\/$/, "");

    // Extract the path after /fhir-proxy
    const subUrl = req.originalUrl.substring("/fhir-proxy".length);
    const urlSuffix = subUrl.startsWith("/") ? subUrl : "/" + subUrl;
    const targetUrl = `${baseUrl}${urlSuffix}`;

    console.log(`[FHIR Proxy] Forwarding ${req.method} request to: ${targetUrl}`);

    // Set up request headers forwarding
    const headers: Record<string, string> = {
      "Accept": "application/fhir+json, application/json",
    };

    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"] as string;
    }

    if (process.env.FHIR_BEARER_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.FHIR_BEARER_TOKEN}`;
    }

    // Set up request body forwarding
    let body: any = undefined;
    if (req.method === "POST" || req.method === "PUT") {
      if (typeof req.body === "object" && Object.keys(req.body).length > 0) {
        body = JSON.stringify(req.body);
      } else if (typeof req.body === "string") {
        body = req.body;
      }
    }

    try {
      const fhirResponse = await fetch(targetUrl, {
        method: req.method,
        headers,
        body,
      });

      const responseStatus = fhirResponse.status;
      const contentType = fhirResponse.headers.get("content-type") || "application/fhir+json";
      
      const responseText = await fhirResponse.text();

      res.status(responseStatus);
      res.setHeader("Content-Type", contentType);
      res.send(responseText);
    } catch (error: any) {
      console.error("[FHIR Proxy] Error fetching from FHIR server:", error);
      res.status(502).json({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: error.message || "Failed to establish a connections to the downstream FHIR server.",
          },
        ],
      });
    }
  });

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TrialBridge Server] Running on http://localhost:${PORT} under environment: ${process.env.NODE_ENV || "development"}`);
  });
}

startServer().catch((err) => {
  console.error("Fatal: failed to start TrialBridge Express Server", err);
});
