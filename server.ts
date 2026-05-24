import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from "openai";

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

  // POST route for AI-powered Clinical Trials Matching using Gemini
  app.post("/api/gemini/analyze-trials", async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: "Gemini API Key is not configured in environment. Please add GEMINI_API_KEY under the Settings > Secrets panel."
      });
    }

    const { patient, trials } = req.body;
    if (!patient || !trials || !Array.isArray(trials) || trials.length === 0) {
      return res.status(400).json({ error: "Missing patient demographic file or trials array" });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          }
        }
      });

      const prompt = `
You are an expert clinical trial feasibility matching system. Analyze the match eligibility of the following patient against active ClinicalTrials.gov studies.

PATIENT CLINICAL DOSSIER:
- Name: ${patient.name}
- Age: ${patient.age}
- Gender: ${patient.gender}
- Active Conditions: ${JSON.stringify(patient.activeConditions || [])}

CLINICAL TRIALS TO EVALUATE:
${trials.map((t: any) => `
---
Trial ID (NCTID): ${t.nctId}
Title: ${t.title}
Phase: ${t.phase}
Sponsor: ${t.sponsor}
Summary: ${t.summary}
Eligibility Criteria Raw Text: ${t.eligibilityCriteria}
Gender Preference: ${t.sex || "All"}
Minimum Age Constrain: ${t.minimumAge || "N/A"}
Maximum Age Constrain: ${t.maximumAge || "N/A"}
`).join("\n")}

For each trial:
1. Estimate a Match Score (0 - 100) based on how well the patient's criteria (age, gender, active diagnoses) correspond with the eligibility criteria, inclusion rules, and exclusion codes.
2. Determine if overall likely "eligible" (boolean).
3. Draft a precise, highly objective 2-3 sentence clinical justification (e.g. "Matches age and diagnosis requirements. However, exclusion parameters for ongoing acute therapies requires secondary verification.").
4. List specific "matchedCriteria" (e.g., "Age (54) lies within range [18-65]", "Has index diagnosis: Type 2 Diabetes").
5. List specific "unmatchedCriteria" (e.g., "Candidate lacks required historical complications", "Exclusion: ongoing insulin-pump usage").

Provide a comprehensive high-level "overallSummary" of recommendations across the entire cohort.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["overallSummary", "analyses"],
            properties: {
              overallSummary: {
                type: Type.STRING,
                description: "Executive high-level cohort matching overview for the provider, highlighting best options."
              },
              analyses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  required: ["nctId", "score", "eligible", "justification", "matchedCriteria", "unmatchedCriteria"],
                  properties: {
                    nctId: { type: Type.STRING },
                    score: { type: Type.INTEGER, description: "Match probability score 0 to 100" },
                    eligible: { type: Type.BOOLEAN, description: "Whether the patient conforms overall to core requirements" },
                    justification: { type: Type.STRING, description: "Clinical match rationale of 2-3 sentences" },
                    matchedCriteria: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    },
                    unmatchedCriteria: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const extractedJsonText = response.text || "{}";
      res.json(JSON.parse(extractedJsonText));
    } catch (error: any) {
      console.error("[Gemini Trial Bridge Exception]:", error);
      res.status(500).json({ error: error.message || "Failed to analyze trials under Gemini engine validation." });
    }
  });

  // POST route for AI-powered clinical trials custom matching using OpenAI
  app.post("/api/match-trials", async (req, res) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        error: "OPENAI_API_KEY is not configured in environment. Please add OPENAI_API_KEY under the Settings > Secrets panel."
      });
    }

    const { patient, trials } = req.body;
    if (!patient || !trials || !Array.isArray(trials) || trials.length === 0) {
      return res.status(400).json({ error: "Missing patient demographic file or trials array" });
    }

    // Set headers for streaming NDJSON to client
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
      const openai = new OpenAI({ apiKey });

      // Run analyses in parallel to minimize response latency
      const analysisPromises = trials.map(async (trial) => {
        try {
          const minAge = trial.minimumAge || trial.minAge || "N/A";
          const maxAge = trial.maximumAge || trial.maxAge || "N/A";
          const sex = trial.sex || "All";
          const eligibilityCriteria = trial.eligibilityCriteria || "No explicit criteria listed.";

          const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are a clinical trial eligibility analyst. Given a patient's clinical profile and a trial's eligibility criteria, analyze whether the patient may qualify. Return ONLY valid JSON with no markdown, no explanation outside the JSON."
              },
              {
                role: "user",
                content: `Patient profile: ${JSON.stringify(patient)}
Trial eligibility criteria: ${eligibilityCriteria}
Minimum age requirement: ${minAge}
Maximum age requirement: ${maxAge}
Sex requirement: ${sex}

Return JSON: { "score": <0-100 integer>, "reasoning": "<2-3 sentence summary>", "met_criteria": ["<list of criteria the patient meets>"], "unmet_criteria": ["<list of criteria the patient does not meet or is unknown>"] }`
              }
            ],
            response_format: { type: "json_object" }
          });

          const responseText = chatCompletion.choices?.[0]?.message?.content || "{}";
          let parsed: any = {};
          try {
            let cleanText = responseText.trim();
            if (cleanText.startsWith("```")) {
              cleanText = cleanText.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
            }
            parsed = JSON.parse(cleanText);
          } catch (pErr) {
            console.error(`Failed to parse json on trial ${trial.nctId}:`, responseText);
            parsed = {
              score: 50,
              reasoning: "Failed to parse API analysis response. Please review eligibility manually.",
              met_criteria: [],
              unmet_criteria: []
            };
          }

          const mappedAnalysis = {
            nctId: trial.nctId,
            score: typeof parsed.score === "number" ? parsed.score : 50,
            reasoning: parsed.reasoning || "No explanation provided.",
            inclusions: parsed.met_criteria || [],
            exclusions: parsed.unmet_criteria || []
          };

          // Write chunk individually for real-time tracking
          res.write(JSON.stringify({ status: "success", data: mappedAnalysis }) + "\n");
          return mappedAnalysis;
        } catch (trialErr: any) {
          console.error(`Error analyzing trial ${trial.nctId} with OpenAI:`, trialErr);
          const failBack = {
            nctId: trial.nctId,
            score: 0,
            reasoning: `OpenAI error: ${trialErr.message || "Unknown error during study analysis"}`,
            inclusions: [],
            exclusions: ["System match failure - check OpenAI service availability"]
          };
          res.write(JSON.stringify({ status: "error", error: trialErr.message || "Failed trial analysis", nctId: trial.nctId, data: failBack }) + "\n");
          return failBack;
        }
      });

      await Promise.all(analysisPromises);
      res.end();
    } catch (globalErr: any) {
      console.error("[Global OpenAI Route Error]:", globalErr);
      // In case we haven't flushed headers yet, we can send standard error, but since we set x-ndjson, write it
      res.write(JSON.stringify({ error: globalErr.message || "Global matching system exception" }) + "\n");
      res.end();
    }
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
