# Equipment Intelligence Architecture

## Purpose

The Equipment Intelligence Platform turns unit selection from a manual catalogue lookup into a deterministic engineering search process:

Project -> Scan Database -> Engineering Filters -> Ranking -> AI Explanation -> Recommended Equipment

AI explains the result only after the Rules Engine produces it.

## Current Foundation

The project already has a local MVP:

- Manufacturer registry sample data
- Catalogue/version model foundation
- Equipment record schema
- CSV import validation
- Duplicate detection
- Sample-data warning
- Deterministic selection engine
- Equipment snapshot binding to project
- Engineer Review checks for selected equipment

## Target Domains

### Manufacturer Registry

Each manufacturer record should include:

- Manufacturer id
- Name
- Country
- Markets
- Official website
- Local agent
- Data availability status
- Last updated date

### Catalogue Management

Each manufacturer may have multiple catalogues:

- Catalogue id
- Manufacturer id
- Year
- Edition
- Version
- Source file
- Source URL
- Imported by
- Imported at
- Review status
- Published status

### Equipment Database

Each model should include:

- Manufacturer
- Exact model number
- Series
- Equipment type
- Cooling capacity
- Sensible capacity
- Airflow
- ESP
- Electrical data
- Dimensions
- Weight
- Noise
- Efficiency
- Refrigerant
- Operating limits
- Market availability
- Discontinued status
- Source catalogue
- Verification status

### Verification Workflow

Allowed status flow:

Imported -> Pending Review -> Verified -> Published -> Archived

Rules:

- Imported records are draft-only.
- Pending Review records can appear in admin views but must be flagged.
- Verified records can be used for engineering selection if they pass Rules Engine filters.
- Published records are visible to normal users.
- Archived records remain available for historical snapshots but are not recommended.

### Version Control

Do not overwrite old equipment data.

When a catalogue or model changes, create a new version and keep:

- Previous value
- New value
- Source
- Change reason
- Reviewer
- Review date

Project snapshots must keep the exact version used at selection time.

### Market Availability

Allowed availability labels:

- Saudi
- GCC
- Global
- Discontinued
- Unknown

## Recommendation Results

The platform should expose these deterministic result buckets:

- Recommended
- Best Alternative
- Lowest Cost
- Highest Efficiency
- Smallest Size
- Lowest Noise
- Healthcare Optimized
- Energy Saving
- Future Expansion Ready
- Saudi Market Preferred

## Ranking Rules

Ranking must be deterministic and auditable.

Scoring should consider:

- Capacity fit
- Airflow fit
- ESP fit
- Electrical match
- Market availability
- Verification status
- Catalogue age
- Efficiency
- Noise
- Dimensions
- Healthcare suitability
- Maintenance/service availability

AI may explain why a result scored well or poorly, but it must not change the order.

## Current Implementation Result

The local foundation now includes a standalone catalogue/version model. CSV imports can attach optional catalogue metadata to records, and selected-equipment snapshots can preserve a catalogue version reference.

## Immediate Next Step

Build the Catalogue Management admin workflow on top of the versioned model: import batches, review findings, approve records, publish records, archive records, and compare versions.
