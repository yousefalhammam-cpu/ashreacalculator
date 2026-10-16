# Catalogue Management Architecture

## Purpose

Catalogue Management allows AirCalc Pro to import, review, verify, publish, archive, and compare equipment data without changing application code.

## Core Objects

### Manufacturer

Owns catalogues and equipment families.

Required fields:

- id
- name
- country
- markets
- officialWebsite
- localAgent
- lastUpdatedAt

### Catalogue

Represents a real manufacturer document or imported dataset.

Required fields:

- id
- manufacturerId
- title
- year
- edition
- version
- sourceType
- sourceUrl
- sourceFileName
- importedAt
- importedBy
- status

### Catalogue Version

Represents a published or reviewed revision.

Required fields:

- id
- catalogueId
- versionNumber
- sourceHash
- changeSummary
- createdAt
- createdBy
- reviewedAt
- reviewedBy

Status: local foundation implemented in `js/equipment/equipment-catalogue.js`.

### Equipment Record

Represents one model in one catalogue version.

Required fields:

- id
- catalogueVersionId
- manufacturerId
- exactModelNumber
- equipmentType
- capacity data
- airflow data
- ESP data
- electrical data
- physical data
- acoustic data
- efficiency data
- operating limits
- verificationStatus
- marketAvailability

### Review Finding

Tracks data-quality problems.

Examples:

- Missing ESP
- Missing sensible capacity
- Missing operating limits
- Suspicious capacity unit
- Duplicate model
- Old catalogue
- Market unavailable

## Workflow

1. Import catalogue file or CSV/JSON.
2. Normalize units and fields.
3. Detect duplicates.
4. Run validation rules.
5. Move to Pending Review.
6. Engineer reviews records and findings.
7. Verified records become eligible for publishing.
8. Published records become available for project selection.
9. Archived records remain linked to old project snapshots.

Status: local workflow foundation implemented for equipment records:

- draft/imported -> pending_review
- pending_review -> verified
- verified -> published
- published -> archived
- sample data cannot enter the verification workflow

Status: local admin review queue implemented in Equipment Database:

- Imported and pending records are surfaced in a review card.
- Batch actions can send imported records to review and verify pending records.
- Reviewer notes can be saved on each review-queue record.
- Rejected CSV rows can be exported with line number, error reason, duplicate type, and key model fields.
- Catalogue versions can be compared locally for added, removed, changed, and unchanged equipment records.
- Cloud catalogue import can merge missing records and mark conflicts without overwriting local data.
- Catalogue conflicts can be resolved explicitly with Keep Local or Use Cloud actions, and the decision is written to workflow history.
- Catalogue conflicts include a field-by-field preview for local versus cloud values before resolution.
- Conflict review includes a conflict-only filter and a safe batch Keep Local action.
- Real manufacturer catalogue CSV import now captures provenance metadata before saving.
- Partial catalogue provenance blocks import so real records are not saved with incomplete source traceability.
- Source catalogue files can be linked locally and fingerprinted with SHA-256 when the browser supports it.
- Catalogue data quality gates block review/verification when critical source, BTU/h, CFM, or required ESP data is missing.
- Sample data is excluded from the review queue.

## Admin Capabilities

The future management screen should support:

- Add manufacturer
- Upload catalogue
- Import CSV
- Import JSON
- Review imported records
- Approve records
- Publish records
- Archive records
- Compare catalogue versions
- View change history
- Export rejected rows

## Data Integrity Rules

- Never delete a published record that was used in a project snapshot.
- Never trust sample data for final engineering selection.
- Do not publish records with missing critical fields unless explicitly marked as limited-use.
- Keep the source reference for every verified value.
- Store units with values or normalize them through a documented conversion layer.

## Immediate Next Step

Next implementation value is Firebase emulator rule tests and real source-file handling for catalogue uploads.
