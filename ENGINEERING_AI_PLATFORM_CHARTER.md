# AirCalc Pro Engineering AI Platform Charter

## North Star
AirCalc Pro is not just an HVAC calculator. It is an engineering AI platform that helps engineers, consultants, and contractors complete the full design workflow faster, with fewer errors, and with stronger calculation discipline.

Every product and code decision must move the platform toward this goal:

> Become the best HVAC Engineering AI platform in the world, not merely a load calculator.

## Decision Priority
Before adding any new feature, follow this order:

1. Fix current bugs.
2. Improve system stability.
3. Improve performance.
4. Preserve calculation correctness.
5. Improve user experience.
6. Add AI capabilities.
7. Improve visual design.

Do not skip this order. Calculation accuracy is more important than UI polish.

## Golden Rule
Any change that can affect calculation results must be tested before it is accepted.

For calculation-related work, verify:

- Input assumptions.
- Unit conversions.
- Engineering formulas.
- Boundary cases.
- Existing workflows that depend on the calculation.
- Report and quotation outputs that consume the result.

## Feature Gate
Before developing a feature, answer these questions:

- Does it reduce engineer time?
- Does it reduce human error?
- Can it be automated?
- Does it make AirCalc Pro meaningfully better than competitors?

If the answer is no, propose a better alternative instead of implementing the feature.

## Engineering AI Agent Direction
The platform should evolve from form-based calculation into workflow-based engineering automation.

Target user prompt:

> Design an HVAC system for an 80 m2 dental clinic.

Target system workflow:

1. Detect project type and room intent.
2. Select the relevant ASHRAE and healthcare assumptions.
3. Estimate or request only missing critical inputs.
4. Calculate cooling load.
5. Calculate outdoor air.
6. Calculate ACH when applicable.
7. Recommend suitable equipment capacity.
8. Recommend air outlets and preliminary distribution.
9. Generate a technical report.
10. Generate a quotation.
11. Save the project.

The AI agent must not replace deterministic engineering calculations. It should orchestrate, validate, explain, detect gaps, and generate engineering documentation from verified calculation outputs.

## AI Usage Policy
Use AI only where it provides real engineering value:

- Project analysis.
- Design review.
- Error detection.
- Improvement suggestions.
- Technical report generation.
- Quotation generation.
- Future drawing and plan reading.

Do not add AI merely as a generic chat feature.

## Stability Rules
Do not break existing functionality.

If a core change is required:

1. Explain why it is required.
2. Explain the risk.
3. Explain the safer alternative.
4. Implement the smallest effective change.

## Code Standards
Code should be:

- Clean.
- Maintainable.
- Modular.
- Reusable.
- Type-safe where the stack allows it.
- Free of unnecessary duplication.
- Free of unused files.
- Free of unnecessary dependencies.

Prefer small, testable modules over adding more complexity to `app.js`.

## Verification Standard
After each implementation phase, verify as much as the current project stack supports:

- Build.
- Lint.
- Type check.
- Tests.
- Browser console.
- Network behavior.
- Performance-sensitive flows.
- Calculation outputs.

If a verification step is unavailable, document that clearly instead of treating it as passed.

## Future Architecture Targets
Design modules so they can later support:

- AirCalc Pro Desktop.
- AirCalc Pro Mobile.
- API.
- SaaS.
- Enterprise Edition.

Avoid browser-only assumptions in calculation and validation logic when practical.

## Phased Roadmap

### Phase 0: Stabilization Audit
- Identify current broken flows.
- Confirm which app entrypoint is the source of truth.
- Confirm calculation modules and dependencies.
- Document known limitations.

### Phase 1: Engineering Validation Layer
- Add a central project snapshot model.
- Add deterministic validation rules.
- Classify findings as `ok`, `needs_input`, `warning`, or `critical`.
- Produce project health, missing inputs, engineering warnings, and next actions.

### Phase 2: Agent Workflow Layer
- Add an Engineering Agent panel.
- Let the agent read current project state.
- Convert validation output into actionable engineering tasks.
- Keep actions rule-based and deterministic first.

### Phase 3: Calculation Hardening
- Separate quick estimate from design review.
- Strengthen cooling load assumptions.
- Strengthen healthcare airflow and ACH checks.
- Strengthen duct and ESP warnings.
- Add calculation regression cases.

### Phase 4: Technical Report Engine
- Redesign reports around assumptions, inputs, calculations, compliance checks, risks, limitations, and recommended next actions.
- Clearly label values as calculated, estimated, or requiring engineering verification.

### Phase 5: AI-Assisted Project Automation
- Add structured prompt intake.
- Convert natural-language project requests into draft project data.
- Ask only for missing critical inputs.
- Generate reports and quotations from verified outputs.

### Phase 6: OCR and Drawing Intelligence
- Read room schedules, areas, and labels from drawings or PDFs.
- Draft project rooms automatically.
- Require user review before accepting extracted data.

### Phase 7: Platform Expansion
- Prepare shared calculation and validation modules for API, desktop, mobile, SaaS, and enterprise workflows.

## Delivery Discipline
Do not implement large features in one pass.

After every phase, report:

- What changed.
- What remains.
- Risks.
- Recommended next step.

