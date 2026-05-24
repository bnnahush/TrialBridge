# TrialBridge 🧬

TrialBridge is a clinical trial feasibility and cohort explorer connecting clinical trials with HL7 R4 FHIR patient directories. By using standard-based REST querying through a robust backend secure proxy layer and a secure AI evaluation engine, TrialBridge enables principal investigators and clinical researchers to seamlessly match patient cohorts with active clinical trials without compromising credentials or violating security constraints.

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

## ✨ Polish for Demo Day (Animations & Polish Pass)

### 🏎️ Transitions & Animations
- **High-Performance Page Transitions:** Features a polished, hardware-accelerated routing transition (`animate-fadeIn`, opacity 0 → 1 over `200ms`) on location changes to eliminate layout flicker.
- **Dynamic Score Donut:** The clinical feasibility score donut on the matching panel smoothly animates from `0%` to its target value over `800ms` on mount using an optimized requestAnimationFrame callback.
- **Match Score Badges:** Recommendation status pills entry scales smoothly from `0.85 → 1` alongside an alpha fade-in (`badgePop` cubic-bezier keyframes) when LLM evaluations resolve.
- **Seamless Loading States:** Bone skeleton placeholders transition smoothly into actual clinical cohorts utilizing CSS fade transitions to avoid jarring screen snaps.

### 🔔 Reactive Global Toast Stack
The application context features an integrated, responsive toast message queue:
- **Multi-State Styling:** Distinct themes for **Success** (green notifications upon saving records or finishing matches), **Error** (red indicators for clinical exception halts), **Info** (blue syncing signals while fetching external clinical registries), and **Warning** (yellow notifications highlighting conditions deficiencies).
- **Auto-Dismiss Lifecycle:** Messages automatically exit after `4 seconds` to reduce overlay clutter, while maintaining manual click-to-dismiss overrides.

### 🛠️ FHIR Gateway Loopback Tool & LLM Profile Setting
The updated `/settings` dashboard offers a premium debugging layout:
- **Downstream Masking:** Automatically parses and masks target URL hosts safely to prevent exposure of sensitive staging/sandbox coordinates.
- **Conformance Handshake:** An active connection handshake tool queries the `/metadata` endpoint on-demand to fetch the active CapabilityStatement, showing the downstream server software and active FHIR Specification version (e.g. `R4 (4.0.1)`).
- **AI Target Indicator:** Identifies the active LLM engine profile in use (`GPT-4o-mini`) configured for clinical reasoning tasks.

### 🖥️ In-App Judge Explainer / About Modal
A comprehensive, accessible judge-facing modal overlay accessible from the navigation rails:
- Synthesizes TrialBridge's technical mission statement.
- Explains underlying HL7 R4 FHIR Resource mappings (`Patient`, `Condition`, `Observation`) and outer integration pathways.
- Explicitly details HIPAA design isolated architecture choices (no PHI cached or stored permanently).

### 🧬 Dynamic Title & Branded Icon Mapping
- **Active Navigation Titles:** Dynamically binds browser header titles on-the-fly (`TrialBridge | Patients Directory`, `TrialBridge | Trial Matching`, etc.).
- **Data URI Favicon:** Automatically injects an elegant, teal-accented DNA helix SVG favicon globally on client load.

---

## 💻 Tech Stack & Dependencies

- **Frontend core Framework:** React 19 (Functional Components, Custom Hooks, Class ErrorBoundaries)
- **CSS Preprocessor & Framework:** Tailwind CSS v4 (configured via `@tailwindcss/vite` plugin for fully compiled performance)
- **Icon Suite:** `lucide-react` (uniform diagnostic look and feel)
- **Transitions and Layout Motion:** Custom hardware-accelerated CSS animations and keyframes
- **Charts and Sparklines:** `recharts` / `d3` (clean data visualizations, gender distributions, and vitals timeline sparklines)
- **State Management:** Custom React Context `AppContext` (managing global load bars and auto-dismiss toast alerts)

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
│   │   ├── ConfigurationStatus.tsx # Downstream connectivity, online indicator, & Conformance Handshaker
│   │   ├── CreateEditPatient.tsx # Unified form handler for creating or editing patient entities
│   │   ├── ErrorBoundary.tsx     # Graceful JS exception boundary layout
│   │   ├── GlobalSearch.tsx      # Debounced patient lookup header bar
│   │   └── TrialList.tsx         # Render engine for active ResearchStudies
│   ├── pages/
│   │   ├── DashboardPage.tsx     # Recharts cohort histograms & analytics
│   │   ├── PatientsPage.tsx      # Master patient lookup directory
│   │   ├── PatientDetailsPage.tsx# Core clinical overview, vitals, sparklines, and history
│   │   ├── PatientNewPage.tsx    # Direct resource creation form
│   │   ├── PatientEditPage.tsx   # Direct resource editing form
│   │   ├── PatientTrialsPage.tsx # Individual patient matching views & ClinicalTrials.gov query
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

### 🩺 Comprehensive Patient Details (`/patients/:id`)
An intensive, professional single-patient view displaying complete healthcare indices:
- **Patient Demographics Card:** Identifiers, birthdates, active medical records numbers, and clinical sync credentials status indicators.
- **Vitals Telemetry Grid:** Shows Heart Rate, SpO2, Body Temp, Weight, Height, and BMI. Vitals with historical data renders beautiful, lightweight responsive mini line sparklines demonstrating trend directions.
- **Condition Hierarchy & Timeline:** Formats FHIR `Condition` resources into a vertical clinical history timeline displaying coding structures (ICD-10 / SNOMED-CT).

### 🧪 Trial Matching Engine (`/patients/:id/trials`)
Integrates a feasibility matching system evaluating live patient conditions against clinical parameters dynamically fetched from **ClinicalTrials.gov**:
- Automatically handles API queries, using patient condition listings to construct active recruiting filters.
- Uses LLM evaluations to establish semantic criteria matching (inclusion/exclusion scoring matrices).
- Interactive sliding match reviews containing animated donuts and recommendation confidence levels.

### 🔍 Global Patient search bar
An intelligent search utility embedded directly in the main header:
- Debounces input queries by `400ms` and triggers on-demand FHIR Patient lookups.
- Allows immediate navigation to a matching EHR file from any area of the application.

### 🛡️ View Stability with Error Boundaries
- Fully guarded page components catch unexpected JavaScript exceptions gracefully.
- Features intuitive diagnostic layouts, detailed crash reporting stack previews, and corrective navigations.

---

## 🔒 Security & HIPAA Policy Compliance

TrialBridge separates its data-flow into two isolated loops to protect protected health information (PHI):
1. **Network Authentication Isolation:** Authorization tokens (`FHIR_BEARER_TOKEN`) reside only in memory on the server host and are never transmitted to the browser.
2. **Contextual Action Logging:** Diagnostic logs stored via `subscribeToFHIRLogs` remain client-local in app memory and are never written to unencrypted log stores or public file bases.
