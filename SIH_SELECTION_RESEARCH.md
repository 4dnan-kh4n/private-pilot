# SIH 2026: competition-focused idea selection

Research checked 9 September 2026. No application implementation has started.

## Scope and evidence

The user rejected the earlier generic commercial ideas and asked for three distinctive, software-only competition proposals grounded in complete problem descriptions. Winning-oriented execution is now the primary ranking criterion; consumer website traffic remains a secondary consideration. No victory or worldwide originality is guaranteed.

The live official website was accessible through the browser, despite a 403 response from the text web fetcher: https://www.sih.gov.in/sih2026PS . Search a statement ID and click its title to open the full description.

The full official descriptions actually reviewed were SIH26002, SIH26165, SIH26171, SIH26228, SIH26102, SIH26018, and SIH26104. The live rows showed 30 September 2026 as the idea-submission deadline at review time; verify with the institution's SPOC, since internal deadlines can differ. The older supplied PDFs showed an earlier date.

## Recommended shortlist

### 1. PrivatePilot — SIH26171

Proposed pitch: let cloud AI help operate a browser while private values are resolved locally.

Core contribution to investigate: an action-capable sanitized page representation. Local vision and DOM evidence identify interface elements and private regions. The server receives useful structure and temporary references; private values and mappings stay in a session-local vault. The client only executes permitted actions against current page elements and approved field purposes. A network-evidence panel shows exactly what this extension sends to its AI service.

Demonstrate a form workflow using fictional records, then introduce a dynamic page mutation, private text inside an image, and an instruction attempting an unrelated disclosure. The intended behavior is successful permitted work, rejected stale actions, and conservative handling of unknown visual regions. Final consequential submission stays with the user.

Evaluate on held-out pages: UI grounding, PII precision/recall, redaction coverage and excessive masking, memory/CPU/GPU use, cold/warm latency, task completion, and private-value leakage in actual outgoing payloads. Baselines should use the same model, tasks and budget: DOM-only redaction, vision-only redaction, and combined perception.

This is not a new category. Prior art includes PrivWeb, Casper, and PrivAgentFlow. Our novelty claim must be a measured improvement in privacy-versus-task-utility and robust local action control, not the existence of redaction.

Constraints: protect screenshots, text, URLs, error logs and telemetry used by our agent; mark unsupported embedded content. Tokens do not guarantee anonymity because context can reveal identity. The extension cannot promise protection from the original website, other extensions, or a compromised device.

First selection gate: one local browser vision model successfully runs on the actual development laptop; a complete test form task works through real local/server messages; measure latency and leakage before building a broad interface.

Sources:
- https://arxiv.org/abs/2509.11939
- https://arxiv.org/abs/2408.07004
- https://neurips.cc/virtual/2025/133172
- https://webpii.github.io/
- https://onnxruntime.ai/docs/tutorials/web/
- https://github.com/web-arena-x/visualwebarena

### 2. Lifeline NE — SIH26002

Proposed pitch: keep remote communities supplied when roads fail.

Core contribution to investigate: convert road uncertainty into an essential-supply decision. Connect stock/consumption estimates, vehicle restrictions, route observations and weather scenarios. Plan dispatch or pre-positioning before demand is unmet. Prioritize the next field verification by how much it could change the supply plan.

This extends the required accessibility and logistics workflow rather than replacing it. Keep the requested mapping, tracking, field reporting, alerts and offline behavior in a narrow geographic pilot.

Demonstrate two clinics/settlements competing for limited capacity; a reported closure changes the plan; an unknown bridge restriction becomes the most useful fact to verify. Reconnecting a phone syncs its queued report and changes the decision. If all viable routes close, show infeasibility. Never call an estimated dispatch deadline a guaranteed safe travel window.

Evaluate against shortest-path dispatch, reactive rerouting, and earliest-stock-out-first allocation on identical scenarios. Measure on-time essential quantities, unmet-demand duration, route-constraint violations, delay error, alert quality and sync correctness. Label synthetic inventories and incident scenarios.

Data risk is material: IMD documents weather APIs and GSI/ISRO have historical hazard information, but no comprehensive live road/bridge or inventory feed has been verified. A phone photo does not certify bridge safety. Get a corridor dataset and one logistics practitioner review before committing.

Existing LogIE and WFP Optimus cover significant related functionality. Proposed distinction: essential-stock deadlines plus explicit uncertainty plus high-value verification tasks tailored to the NER workflow. It is a hypothesis requiring comparison, not a first-ever claim.

Sources:
- https://api.imd.gov.in/public/api_reference.html
- https://api.imd.gov.in/public/index.php
- https://bhusanket.gsi.gov.in/index.html
- https://www.isro.gov.in/ISRO_EN/Landslide_Atlas_India.html
- https://logie-manual.logcluster.org/en/basics-logie
- https://www.wfp.org/stories/against-all-odds

### 3. DrishtiSeal — SIH26228

Proposed pitch: determine what changed when a vision-AI pipeline becomes unreliable, and preserve verifiable evidence.

Core contribution to investigate: controlled replay and a portable evidence bundle. Hold input constant and compare trusted/candidate preprocessing and model components where access permits. Combine these results with source-level dataset checks, model fingerprints, shift analysis and signed inference receipts. Separate definite artifact alteration from statistical suspicion and unsupported tests.

Demonstrate four failures using benign public image tasks: changed lighting, substituted model, a documented benchmark backdoor, and an edited/replayed prediction record. The conclusions must differ. Verify a report bundle offline on another process or machine; show which tests could not run in black-box mode.

Implement with established detection and cryptographic tools. Respect the full brief's formats and offline requirements; demonstrate more than one architecture and dataset schema. Do not require retraining for basic assessment. Architecture-independent loading does not make every detector architecture-independent.

Evaluate detector recall at fixed false-positive rate, benign-shift false alarms, data-quality issue detection, substitution/tamper/replay checks, runtime, memory and coverage by attack/model family. A signed receipt binds recorded artifacts; it does not prove semantic correctness or that the signing host is uncompromised. A hash chain needs trusted signed checkpoints and verifier state to make relevant rewriting/replay detectable.

Existing Cleanlab, ART, BackdoorBench, TrojAI and signing tools cover individual functions. The contribution is integrated diagnosis and reproducible evidence, not an invented universal backdoor detector.

First selection gate: run an existing public vision benchmark and at least one integrity detector on available hardware. This is the most technically difficult option and requires deliberate ML/security learning.

Sources:
- https://pages.nist.gov/trojai/docs/data.html
- https://backdoorbench.github.io/index.html
- https://docs.cleanlab.ai/master/
- https://adversarial-robustness-toolbox.readthedocs.io/en/main/
- https://docs.sigstore.dev/cosign/verifying/verify/

## Alternatives considered but not selected

- SIH26165: excellent safety impact and a credible evidence-linked barrier-memory concept, but representative OIL reports and an HSSE reviewer are essential. Commercial PSIF classifiers already exist.
- SIH26102: financial/project anomaly monitoring needs sufficiently detailed and comparable data. Public dashboard availability does not establish raw-data availability or fraud labels.
- SIH26018: multilingual handwriting quality and government integration access need substantial validation; an attractive OCR interface would not satisfy the difficult parts.
- SIH26104: near-real-time voice detection across unseen generators, codecs, accents and communication platforms is substantially harder than classifying uploaded audio clips.

## Recommendation

Select PrivatePilot provisionally: strongest balance of current problem fit, visible technical proof, controllable test environment, accessible research resources and potential public adoption. Confirm laptop feasibility and baseline performance before locking the submission. Lifeline NE is the strongest social-impact narrative; DrishtiSeal is the deepest technical option.

For any choice: a submitted proposal should include a requirements matrix, prior-art comparison, testable differentiation, live demonstration, failure cases, evaluation against a baseline, and an adoption path. The team must be able to explain the implementation and results. Build in approved phases after idea selection; do not present code generation as proof of correctness or competition success.
