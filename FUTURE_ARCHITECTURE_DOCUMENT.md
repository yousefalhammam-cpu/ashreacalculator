# AirCalc Pro Future Architecture Document

## Platform Name

AirCalc Pro - Intelligent HVAC Engineering Platform

## Purpose

AirCalc Pro is no longer treated as a calculator-only product. The platform architecture must support the full HVAC engineering workflow: project analysis, load calculation, equipment intelligence, engineering review, professional reporting, quotation support, and future learning from anonymized project outcomes.

## Architecture Principle

Engineering numbers must come from deterministic engines and documented knowledge sources, not from AI text generation.

AI may explain, summarize, compare, and guide. AI must not invent models, catalogues, specifications, calculation results, or override the Rules Engine.

## Five-Layer Architecture

### Layer 1: Engineering Calculation Engine

Status: implemented foundation.

This remains the single source of truth for:

- Cooling load
- BTU/h
- TR
- Supply CFM
- Outdoor air CFM
- ACH
- Exhaust CFM
- Fresh air
- Mixed air
- Duct sizing
- Air velocity
- ESP
- Safety factor
- Market BTU rounding
- Healthcare calculations

Rule: do not reimplement this layer. All future modules must call this layer for engineering values.

### Layer 2: Engineering Knowledge Base

Status: implemented local foundation.

This layer stores engineering references, assumptions, validation rules, glossary entries, and source status. It must be independent from AI and callable by the Calculation Engine, Equipment Intelligence, Reports, and Engineer Review.

### Layer 3: Equipment Intelligence Platform

Status: partially implemented as a local MVP.

This layer manages manufacturers, catalogues, equipment records, versioning, market availability, verification status, deterministic recommendation, and selected-equipment snapshots.

### Layer 4: AI Engineering Assistant

Status: foundation only.

AI explains deterministic results. It does not calculate or rank. The frontend must not contain AI provider API keys. AI calls must go through a backend service layer.

### Layer 5: Continuous Learning Platform

Status: architecture only.

This layer learns from anonymized project metadata and engineering outcomes without exposing customer data. It provides usage patterns and similar-project insights, not private project disclosure.

## Dependency Direction

Allowed dependency direction:

1. UI calls Application Services.
2. Application Services call Calculation Engine, Knowledge Base, Equipment Intelligence, and AI Backend.
3. Rules Engine consumes Calculation Engine, Knowledge Base, and Equipment Snapshots.
4. AI consumes sanitized outputs from Rules Engine and Knowledge Base.
5. Continuous Learning consumes anonymized project events only.

Forbidden dependency direction:

- AI must not call or replace calculation formulas.
- AI must not write verified equipment records directly.
- UI must not hard-code engineering constants.
- Reports must not compute independent engineering values when the Calculation Engine can provide them.

## Future Integration Points

The architecture must allow future integrations without rewriting the product:

- Revit plugin
- AutoCAD plugin
- IFC import
- BIM model import
- IoT integration
- BMS integration
- Energy simulation
- Digital twin

## First Implementation Result

The first implementation step has created the Engineering Knowledge Base as a structured local module and routed Engineer Review source-status reads through it when available. This improves trust immediately without requiring backend or AI.
