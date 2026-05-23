# TrialBridge 🧬

TrialBridge is a clinical trial feasibility and cohort explorer connecting clinical trials with FHIR patient directories. By using standard-based REST querying through a robust backend secure proxy layer, TrialBridge enables principal investigators and clinical researchers to seamlessly match patient cohorts with active clinical trials without compromising credentials or violating security constraints.

---

## 🏛️ Architecture & Core Logic Decisions

### 1. Hybrid Client-Server Full-Stack Setup (Express + Vite 6)
To secure clinical API keys, bearer authorization tokens, and downstream URL configurations, TrialBridge is split into a robust Express API proxy layer and a high-performance React 19 SPA client.
- **Server Entrypoint (`server.ts`):** Handles CORS policy headers, body parsing, environments configurations, and requests proxying.
- **Unified CJS Bundling (`dist/server.cjs`):** In production mode, `esbuild` compiles and bundles the TypeScript backend server into a single CJS bundle file, resolving all relative imports at compile-time. This eliminates standard Node modules relative path import strict checks and achieves extremely low cold-start latency.
- **Client Deployment:** Express acts as a clean static-file host serving pre-built SPA bundles from `dist/` in production, utilizing Vite's native middleware mode in development.

### 2. Secure Downstream FHIR Proxy (`/fhir-proxy/*`)
Rather than enabling clients to query HIPAA-regulated clinical directories directly (which would expose endpoint routes and sensitive bearer tokens in browser DevTools), the Express backend handles secure proxying:
- **Authentication Masking:** The backend checks for a secure `FHIR_BEARER_TOKEN` in the environment and appends it as an authorized `Authorization: Bearer <token>` header only on the server container.
- **Standard Routing Proxy:** Any request sent to `/fhir-proxy/*` is automatically forwarded to the configured custom FHIR server (`FHIR_BASE_URL`, defaulting to the public HAPI FHIR server at `https://hapi.fhir.org/baseR4`).
- **Standard OperationOutcomes:** If downstream calls fail, the server maps native exceptions into structured FHIR-compliant `OperationOutcome` diagnostic JSON bodies so client managers can display human-readable error banners.

### 3. Real-Time Publish-Subscribe FHIR Logs Logging Module
To maintain high clinical audit standards, `src/fhirClient.ts` provides a custom sub/pub logging channel:
- **`subscribeToFHIRLogs(listener)`**: Any component can subscribe in real-time to active REST queries.
- **Reactive Logging Interface:** Standard queries made by the user reactively populate the inline **FHIR Logs Console** in real-time. This presents execution durations (in ms), HTTP method indicators, request endpoints, statuses, and formatted preview payloads.

---

## 💻 Tech Stack & Dependencies

- **Frontend core Framework:** React 19 (Functional Components, Custom Hooks)
- **CSS Preprocessor & Framework:** Tailwind CSS v4 (configured via `@tailwindcss/vite` plugin for fully compiled compile-time performance)
- **Icon Suite:** `lucide-react` (uniform diagnostic look and feel)
- **Transitions and Layout Motion:** `motion` (elegant drawer, slide, and modal fade-in animations)
- **Charts and Sparklines:** `recharts` / `d3` (clean data visualizations, gender distributions, and vitals timeline sparklines)
- **State Management:** Custom React Context `AppContext` (tracking global loading overlays, clinical sync notifications, and OperationHalt errors)

---

## 📂 Project Structure & Feature Mapping

```text
├── server.ts                 # Express full-stack proxy & production static server
├── index.html                # Main SPA entrypoint template
├── package.json              # System scripts ("dev", "build", "start", "lint") & dependencies
├── metadata.json             # TrialBridge description and platform permissions
├── src/
│   ├── main.tsx              # Main JS DOM mount loader
│   ├── App.tsx               # Main React component establishing shell, headers, and routes
│   ├── fhirClient.ts         # Query engine, REST resource utilities & real-time pub-sub logs channel
│   ├── types.ts              # Absolute type definitions matching HL7 FHIR standard specifications
│   ├── components/
│   │   ├── FHIRLogConsole.tsx    # Live diagnostic HTTP audit logger
│   │   ├── QueryBuilder.tsx      # Multi-query structured Boolean filters
│   │   ├── ConfigurationStatus.tsx # Downstream connectivity/online indicator
│   │   ├── CreateEditPatient.tsx # Unified form handler for creating or editing patient entities
│   │   └── TrialList.tsx         # Render engine for active ResearchStudies
│   ├── pages/
│   │   ├── DashboardPage.tsx     # Recharts cohort histograms & analytics
│   │   ├── PatientsPage.tsx      # Master patient lookup directory
│   │   ├── PatientDetailsPage.tsx# Core clinical overview, vitals, sparklines, and history
│   │   ├── PatientNewPage.tsx    # Direct resource creation form
│   │   ├── PatientEditPage.tsx   # Direct resource editing form
│   │   ├── PatientTrialsPage.tsx # Individual patient matching views
│   │   ├── TrialMatchesPage.tsx  # General eligibility matcher across all targets
│   │   └── SettingsPage.tsx      # Environment variables, proxy verification, and connection diagnostic status
```

---

## 🚀 Page & Feature Walkthrough

### 📊 Dashboard
Displays high-level statistical summaries using interactive **Recharts** visualizations:
- Active clinical trial cohorts status reports.
- Patient gender and birth years histograms.
- Distribution graphs demonstrating target conditions.

### 👥 Patients Directory (`/patients`)
Includes an advanced, clean lookup table allowing researchers to find specific patient files:
- Real-time searching by name and clinical index.
- Includes the `QueryBuilder` component, enabling clinical investigators to construct boolean query filters based on gender, age, and clinical active states.
- The **Live FHIR Diagnostic Console** sits directly under the directory container, logging every search transaction in real time.

### 🩺 Comprehensive Patient PatientDetails (`/patients/:id`)
An intensive, professional single-patient view displaying complete healthcare indices:
- **Patient Demographics Card:** Identifiers, birthdates, active medical records numbers, and clinical sync credentials status indicators.
- **Vitals Telemetry Grid:** Shows Heart Rate, SpO2, Body Temp, Weight, Height, and BMI. Vitals with historical data renders beautiful, lightweight responsive mini line sparklines demonstrating trend directions.
- **Condition Hierarchy & Timeline:** Formats FHIR `Condition` resources into a vertical clinical history timeline displaying coding structures (ICD-10 / SNOMED-CT).

### 🧪 Trial Matching Engine (`/trial-matches`)
Integrates a feasibility matching system evaluating FHIR `ResearchStudy` resources against the current patient demographic cohort data:
- Automatically detects patients fitting eligibility constraints (such as age, location, and qualifying active conditions).
- Renders detailed eligibility reports that highlights matches on condition code targets.

### ⚙️ Settings Profile (`/settings`)
Shows system connection attributes:
- Verification of custom `FHIR_BASE_URL` setup states.
- Verification of secret authorization header flags in the proxy server.
- Diagnostic ping test widgets verifying connectivity with the backend server.

---

## 🔒 Security & HIPAA Policy Compliance

TrialBridge separates its data-flow into two isolated loops to protect protected health information (PHI):
1. **Network Authentication Isolation:** Authorization tokens (`FHIR_BEARER_TOKEN`) reside only in memory on the server host and are never transmitted to the browser.
2. **Contextual Action Logging:** Diagnostic logs stored via `subscribeToFHIRLogs` remain client-local in app memory and are never written to unencrypted log stores or public file bases.
