# Wiki Log

Append-only chronological record of wiki activity.

## [2026-05-20] init | Project wiki created

Scaffolded wiki directory structure with entities/, requirements/, decisions/, notes/.

## [2026-05-20] ingest | Software Engineering Take Home Test v2.0.pdf

Source: `[[raw/Software Engineering Take Home Test v2.0.pdf]]`

Pages created:
- [[wiki/overview]] — project synthesis
- [[wiki/entities/developer]], [[wiki/entities/task]], [[wiki/entities/skill]] — entity pages
- [[wiki/requirements/part1-database]] through [[wiki/requirements/part6-containerization]] — 6 requirement pages
- [[wiki/index]] — content catalog

## [2026-05-20] ingest | Re-ingest Software Engineering Take Home Test v2.0.pdf (gap fill)

Source: `[[raw/Software Engineering Take Home Test v2.0.pdf]]`

Gaps found on second pass:
- Part 7 (Deliverables) had no requirement page — created [[wiki/requirements/part7-deliverables]]
- "Important Notes" section (meta-constraints, assumptions, AI usage, timeline, sample tasks) was not captured — created [[wiki/notes/meta-constraints]]
- Updated [[wiki/overview]] to wikilink Part 7
- Updated [[wiki/index]] with new pages

## [2026-05-20] ingest | Discussion with gemini about the Project.md

Source: `[[raw/notes/Discussion with gemini about the Project.md]]`

29-message Gemini conversation exploring the project through DDD and TOGAF lenses. Covers database schema design, API contracts, implementation patterns (Prisma, recursive payloads, LLM integration, recursive React components), and Docker containerization strategy.

Pages created:
- [[wiki/notes/gemini-design-discussion]] — comprehensive summary of DDD framing, bounded contexts, implementation patterns
- [[wiki/decisions/001-prisma-orm]] — ADR: Prisma ORM with explicit join tables
- [[wiki/decisions/002-recursive-task-payload]] — ADR: recursive JSON payload for atomic tree creation
- [[wiki/decisions/003-docker-multi-stage]] — ADR: multi-stage Docker builds with Nginx

Pages updated:
- [[wiki/index]] — added decisions and notes entries

## [2026-05-20] ingest | Research papers (7 PDFs in raw/papers/)

Sources: `[[raw/papers/01-llm-in-requirement-engineering.pdf]]` through `[[raw/papers/06b-structural-complexity-htn-planning.pdf]]`

Ingested 7 research papers across 3 pillars referenced in the Gemini design discussion:
- Pillar 1 (LLM in RE): systematic review of 29 studies; empirical study of AI-generated user stories with US-Prompt technique
- Pillar 2 (Skill allocation): TASE skill-matching system with weighted scoring; SBSPM literature review of 52 studies
- Pillar 3 (Hierarchical state): DDD by Eric Evans (sample); HTN planning with state constraints (IJCAI-17); structural complexity analysis of HTN (arXiv 2025)

Pages created:
- [[wiki/notes/research-papers]] — consolidated summaries with project relevance for all 7 papers

Pages updated:
- [[wiki/index]] — added research papers note
