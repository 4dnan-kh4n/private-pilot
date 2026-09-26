# SwiftRoute — copy-ready AI build prompt

---

Act as my senior mobile engineer, backend engineer, product designer, and QA engineer. Build SwiftRoute, a working Indian ride-booking product, through the approval-gated phases below. Deliver runnable source code and verified functionality, not just advice, screenshots, or a frontend mockup. Do not claim you can obtain commercial permissions, credentials, regulatory approvals, or app-store approval through code.

## Product objective

Passengers wait for a ride on one platform while eligible drivers nearby may be using another. Drivers also switch between multiple apps to find work. I want a passenger app, a separate driver app, and a web administration console. The long-term goal is approved integration with Ola, Uber, and Rapido, including a unified driver experience wherever explicitly supported. Drivers pay our platform a 2% commission on eligible completed rides sourced through SwiftRoute.

Use “passenger” for the customer and “driver” for the service provider. SwiftRoute is a working name; do not claim trademark availability.

The first release should validate reliable matching, transparent driver earnings, and useful operations in one city and one legally permitted vehicle category. Do not add speculative features, an AI chatbot, a social feed, cryptocurrency, ride pooling, loyalty systems, or microservices.

## Non-negotiable phase approval protocol

1. Work on ONE phase at a time, beginning with Phase 0. Do not implement later phases early.
2. At the end of every phase, provide the deliverables, exact run/review instructions, test results, remaining defects, external blockers, and a short manual acceptance checklist.
3. Then STOP and wait. Proceed only after I explicitly approve that phase, for example: “APPROVE PHASE 2”. Silence, unrelated questions, and feedback are not approval.
4. If I request changes, revise the same phase, verify the changes, and ask for approval again.
5. Maintain a small PROJECT_STATUS.md recording the current phase, accepted decisions, evidence of approvals, blockers, and next authorized action. On a resumed session, read it first and never invent an approval.
6. Routine implementation choices within an approved phase do not need repeated permission. Ask only for material missing decisions. Do not make purchases, send partnership emails, publish publicly, book real rides, or charge real money without specific authorization.

## Integration honesty and business boundaries

Research current official provider documentation and terms in Phase 0. Record dated source URLs and distinguish documented capabilities, contract permissions, assumptions, and unknowns. Documentation or a sandbox key does not prove production eligibility.

Treat these as separate capabilities: estimates, passenger booking, trip status, cancellation, receipts, driver history, incoming driver offers, driver acceptance, driver availability control, and settlement access. A passenger booking API or driver-history API does not establish driver-dispatch access.

Check especially whether provider terms allow competitor comparisons, inclusion in the same app, data combination, driver-app replacement, and our 2% driver fee. Require written permission where applicable, independently of user OAuth consent. Do not implement competitor comparison with restricted provider data by default.

No scraping, private mobile endpoints, credential or OTP collection for third-party accounts, notification interception, accessibility-based auto-clicking, or reverse-engineering as an integration shortcut. Use official delegated authorization for approved connections. Use documented deep links only where permitted and device-tested; never invent URL schemes. A deep link is a handoff, not proof of booking, driver availability, completion, or commission entitlement.

Do not claim that an existing Rapido request becomes an Uber or Ola request or that one provider can directly dispatch another provider's driver. External providers retain control of their own supply unless a specific agreement says otherwise. Do not claim access to rides created outside SwiftRoute without a verified authorized capability.

Propose three clearly distinguished implementation modes for my decision in Phase 0:
- Direct network: drivers separately onboard to SwiftRoute; SwiftRoute matches its own passenger requests to its own eligible drivers. Existing registration elsewhere is not sufficient onboarding or an integration.
- Approved partner network: only the operations authorized by a provider or participating open mobility network.
- Demonstration: deterministic simulated providers and GPS, clearly marked as simulated everywhere they appear.

My preferred fallback proposal is a direct-network pilot while partnership requests are pending, but obtain my Phase 0 approval before committing to that scope. If I insist on all three commercial integrations, preserve that requirement and mark blocked capabilities honestly. Do not silently substitute a standalone taxi app and declare the original integration goal complete.

## Commercial rules

Propose this initial policy for approval: commission is 2.00% of the final eligible transport fare after discounts, excluding tips, taxes, tolls, parking, refunds, and cancellation charges. Resolve who funds discounts and any applicable tax on our fee in Phase 0 with the business owner and appropriate professional advice. Do not silently replace 2% with a subscription or add a passenger fee.

Calculate money on the server using integer paise or fixed-precision decimals with documented half-up rounding to one paise. For an eligible fare of INR 200, commission is INR 4; the simplified driver amount is INR 196 before separately disclosed items. Show passenger fare, fee base, our commission, applicable tax, other authorized deductions, and driver net separately.

Charge once per eligible completed trip. Canceled or failed trips have no 2% commission under the default policy. Refunds create traceable proportional fee reversals; rounding cannot cause total reversal to exceed the original fee. Snapshot the applicable fee policy per trip so later settings changes do not rewrite history.

For cash/direct-to-driver payments, track commission receivables and reconcile actual collection. A passenger tapping “paid” is not authoritative payment evidence. For online collection, use an approved payment provider's supported collection/settlement product and verified server-side events. Do not build a custodial wallet or an assumed split-settlement flow. Keep pending, successful, failed, refunded, and disputed states distinct.

For external-provider rides, never assume we can deduct from their driver settlements. Enable our fee only when trip attribution, driver agreement, contractual permission, and collection mechanics are established. Do not charge on unrelated trips or app launches.

## Required experiences

Passenger app:
- Phone authentication; explicit location permission; manual pickup fallback.
- Pickup pin adjustment, destination search, service availability, and an honest fare estimate or quote with expiry.
- Request a ride, cancel under a disclosed policy, receive assignment, view vehicle/driver details, and track the trip with location freshness shown.
- Secure trip-start OTP, trip sharing with expiring access, safety/support access, receipts, history, ratings, and account deletion request.
- Clear states for no drivers, expired quote, denied permission, poor GPS, disconnected internet, provider failure, and payment failure.

Driver app:
- Registration; secure document upload; review and expiry enforcement for identity, driving eligibility, vehicle documents, and other locally required checks.
- Online/offline availability; offer expiry; accept/decline; clear pickup, expected payout, and permitted trip details before acceptance.
- Arrive, validate passenger OTP, start, complete, cancel with reason, and open navigation through an appropriate supported navigation app.
- Earnings with transparent 2% commission, outstanding commission receivables where applicable, settlement history, support, and safety access.
- Location sharing limited to disclosed operational purposes and app states; stale-location exclusion from matching; safe resume after disconnect.
- For SwiftRoute, stop additional offers during an active assignment. Do not pretend to control other driver apps without approved support. External availability conflicts require an honest manual or authorized synchronization flow.

Admin web console:
- Secure role-based access; driver approval and expiry review; service-zone/category controls; active trip monitoring; cancellations and support incidents.
- Fare configuration for our own network; commission reconciliation; controlled refunds/adjustments; auditable admin actions.
- Useful pilot measures: requests, offer acceptance, completed rides, pickup delay, no-driver rate, cancellations, paid commission, outstanding balances, and estimated variable cost per completed trip.
- Provider status and a kill switch for unhealthy integrations. Show operational incidents and failed background jobs.

Safety features must do what they say. A button opening an emergency dialer must not claim to summon a staffed response team. Do not claim identity verification, insurance coverage, masked calling, or 24/7 support unless those services are actually provisioned and tested.

## UI quality: it must not look like a generic AI-generated app

Design a cohesive, original transport product around actual passenger and driver tasks. Use restrained colors, deliberate typography, consistent spacing, appropriate density, readable maps, useful icons, and strong hierarchy. Avoid generic purple gradients, glass cards everywhere, oversized dashboard metrics on booking screens, decorative charts, and placeholder marketing copy.

Create two distinct visual directions for me to review during the design phase. Make passenger booking map-centered and easy to use one-handed; make driver screens glanceable with large controls and unambiguous trip status. Use natural English and localization-ready strings; propose Hindi plus the pilot city's language according to actual users.

Provide complete loading, empty, error, offline, permission, and success states. Support accessible contrast, screen readers, text scaling, keyboard use in admin, and appropriate touch targets. Use realistic Indian locations and INR formatting in test data without using real people's personal information. Use provider branding only with permission. Do not copy a competitor's complete interface.

Visually inspect implemented screens at representative phone sizes and the admin desktop width. Supply screenshots or a short recording and explain any visual gaps. Do not consider a screen complete just because it compiles.

## Engineering expectations

Inspect existing workspace instructions and code before choosing tools. Reuse working code and established dependencies. If starting empty, propose one mainstream cross-platform mobile stack, one simple backend, PostgreSQL with geospatial support where justified, and a web admin. Explain the choice briefly in Phase 0; pin compatible versions and verify official documentation. Start with a modular monolith. Add queues, caches, or new services only for demonstrated needs.

Use persistent server-side state, migrations, validation at trust boundaries, role/object authorization, protected document storage, secrets outside source control, and development/staging/production separation. Prevent passengers or drivers from reading other people's rides or documents. Avoid sensitive logs. Define data retention, deletion, backup, and restore behavior.

Design an explicit trip lifecycle with server-authorized transitions. Matching must consider category, eligibility, zone, location freshness, availability, and offer expiry. Use transactions/constraints so simultaneous accepts cannot assign two drivers to one trip or overlapping trips to one driver. Reject late accepts and revoke losing offers. Do not rely on client flags or a process-local lock for correctness.

Make booking, completion, commission posting, and payment event processing idempotent. Handle retries, duplicate/out-of-order events, expired offers, timeouts after a provider may have accepted a booking, and reconnects. On an uncertain external booking result, reconcile status before retrying or switching providers. Keep one active external booking attempt; do not book all three and cancel the losers. Any replacement with changed price or cancellation liability requires passenger confirmation.

Use verified push notifications and suitable realtime updates; treat them as delivery mechanisms, not the authoritative database. Use adaptive location updates with platform-compliant background operation. Measure battery behavior on real devices before making savings claims. A simulator cannot validate killed-app behavior, background restrictions, real GPS, or battery use.

Keep a small capability boundary around actual integrations; do not fabricate dozens of provider endpoints or abstractions. In production, missing configuration or permission must disable the capability clearly, never fall back silently to simulated success. Development simulation must be deterministic, resettable, and impossible to enable accidentally in production.

Include runnable tests proportionate to risk, especially concurrency, trip transitions, access control, OTP attempts, fee rounding/reversals, payment authenticity, and retries. Use the smallest useful test setup. Never claim tests, builds, deployment, or device checks passed unless you ran them; report unavailable environments precisely.

## Phases and acceptance gates

Phase 0 — Feasibility and committed scope
Deliver a short product brief, dated integration capability/permission matrix, launch-city/category questions, regulatory and operational dependencies, driver onboarding plan, payment/2% unit economics, technical choice, cost assumptions, acceptance plan, and draft partnership questions. Ask at most five essential questions together. Research with what is available, but do not invent answers. No application implementation. Gate: I approve the launch scope, mode, fee policy, stack, and blocked external capabilities.

Phase 1 — UX and visual design
Deliver the passenger, driver, and admin journeys; two visual directions; the chosen direction as a runnable interactive prototype with explicitly simulated data; and the key failure states. No live booking or payment. Gate: I can review the core flows and approve the visual direction and usability.

Phase 2 — Application foundation
Build runnable passenger and driver shells, admin authentication, backend, persistent database/migrations, environment setup, permission handling, authorization, and safe demo accounts. Gate: clean setup works; sessions persist; unauthorized cross-account access is rejected; development shortcuts cannot activate in production.

Phase 3 — Complete direct-network ride flow or the approved equivalent
Implement onboarding/review, availability, eligibility, estimates, matching, offer expiry, atomic acceptance, tracking, OTP start, completion, cancellation, and reconnect behavior. Gate: demonstrate a ride end-to-end between separate passenger and driver devices/clients through the actual backend and database. Demonstrate two drivers accepting simultaneously, unavailable supply, stale GPS, late acceptance, and connectivity loss. Clearly label simulated travel when real movement has not been tested.

Phase 4 — Commission, payment, and reconciliation
Implement the approved 2% rules, receipts, cash receivables if included, online payment sandbox integration, verified callbacks, fee reversals, and admin reconciliation. Gate: INR 200 produces INR 4 commission; duplicate completion/events never double-charge; partial refunds reconcile; failed or disputed money movement remains visible. Separate financial records from actual funds movement. No real charges without authorization.

Phase 5 — Approved external integrations
Implement one permitted provider/network at a time using actual supplied credentials and official interfaces. Verify estimates, booking, status, cancellation, and any additional granted capability. Driver offers/acceptance are separate milestones requiring explicit support. Gate: provide evidence for each live or sandbox capability, exact limitations, and required permission. If access is absent, deliver the blocker report and contract-tested simulation only; mark commercial integration incomplete. Stop for my decision before continuing with a reduced-scope pilot.

Phase 6 — Safety, operations, and release hardening
Complete real support/incident workflows, location privacy, onboarding expiry, accessibility, security verification, monitoring, backup restore, performance checks, and device testing. Gate: the approved pilot's release criteria pass; outstanding risks and any external dependencies are explicit. No cosmetic “SOS works” claims or assertions of legal approval without evidence.

Phase 7 — Private pilot and deployment
Prepare a private staging deployment, reproducible mobile builds, installation/distribution instructions, admin access setup, and operations runbook. Run a controlled pilot only after I authorize real participants, live rides, and any payment activity, and required operating conditions are satisfied. Measure completion, wait time, battery usage, driver satisfaction, commission collection, and variable costs. Gate: I review evidence and approve or reject expansion. Public release is a separate decision.

Phase 8 — Final delivery and handover
Deliver all source code, migrations, sample environment files, architecture summary, API documentation, automated checks, build artifacts where the environment supports them, deployment/rollback/restore instructions, onboarding/support runbooks, and exact recurring service costs or unresolved quotations. Provide a requirements-to-evidence checklist. Do not commit secrets or personal data. Distinguish “demo complete,” “approved pilot complete,” and “full requested commercial integration complete.” Gate: my final acceptance.

## Definition of complete

A working app means passenger actions persist through a real backend, reach an eligible driver, progress through authorized ride states, calculate and reconcile the approved fee, and appear correctly in admin. Appropriate failure cases must work too. A styled frontend or simulated provider response does not satisfy production integration.

Full original scope is complete only when all agreed Ola/Uber/Rapido capabilities are contractually permitted, technically implemented, and verified in the agreed environment. If a dependency prevents this, keep it open rather than making a success claim. AI can build software, but commercial access, paid services, licenses, operational staffing, physical-device testing, and distribution accounts may require my participation.

Begin with Phase 0 only. End with its review package and STOP for my approval.

---

Research starting points (recheck before implementation; observed 9 September 2026):

- Uber third-party rides: https://developer.uber.com/docs/third-party-rides-demand-v1/introduction
- Uber API terms: https://developer.uber.com/docs/riders/terms-of-use
- Uber driver API: https://developer.uber.com/docs/drivers/introduction
- Ola developer access: https://developers.olacabs.com/docs/overview
- Rapido contact: https://www.rapido.bike/Contact
- ONDC mobility participation: https://resources.ondc.org/mobility
- ONDC shared mobility: https://www.ondc.org/pages/shared-mobility.html
- Ministry of Road Transport and Highways: https://morth.gov.in/
- MeitY DPDP rules and enforcement timeline: https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa?pageTitle=Digit
- Payment pricing example: https://razorpay.com/pricing/

