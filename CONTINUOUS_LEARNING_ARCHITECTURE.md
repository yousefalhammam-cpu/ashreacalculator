# Continuous Learning Architecture

## Purpose

The Continuous Learning Platform helps AirCalc Pro improve recommendations from historical project outcomes without exposing customer data.

It should answer questions such as:

- How many similar projects exist?
- Which equipment models are commonly selected for this project type?
- How often did engineers override the recommendation?
- Which Engineer Review warnings commonly appeared?
- Which selected units were later replaced?

## Privacy Principle

No customer-identifying data should be shown in learning results.

Learning outputs must be aggregated, anonymized, and thresholded. For example, do not show a pattern unless enough projects exist to prevent identifying a client.

## Captured Project Signals

For each project, store an anonymized learning event with:

- Building type
- Country
- City
- Climate region
- Number of rooms
- Total cooling load
- Total airflow
- System type
- Selected manufacturer
- Selected model
- Whether the engineer changed the recommendation
- Whether Engineer Review warnings appeared
- Whether the unit was replaced later
- Equipment verification status
- Project completion status

## Excluded Data

Do not store in learning events:

- Client name
- Project name
- Exact address
- Phone numbers
- Emails
- Full reports
- Pricing details tied to a customer
- Private notes

## Similarity Model

The first version should be rules-based, not AI-based.

Possible similarity dimensions:

- Building type
- Country/city/climate
- Load range
- System type
- Healthcare vs non-healthcare
- Room count range
- Required ESP range

## Future Outputs

The system may say:

- "328 similar projects found."
- "Most selected unit: Daikin XXXXX, used in 24% of similar projects."
- "Engineers changed the recommendation in 18% of similar projects."
- "Most common warning: ESP below selected duct requirement."

It must not reveal the projects behind those statistics.

## Storage Recommendation

Local-only MVP:

- Store a small anonymized learning summary in localStorage for testing.

Firebase production:

- Store anonymized event documents in a dedicated collection.
- Use security rules to prevent users from reading raw events directly.
- Use backend aggregation or scheduled jobs before exposing insights.

## Immediate Next Step

Define the anonymized event schema and add it to documentation only. Do not collect production learning events until privacy rules and aggregation strategy are approved.

