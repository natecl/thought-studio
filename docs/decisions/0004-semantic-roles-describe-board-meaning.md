# ADR 0004: Semantic roles describe Board meaning, not authorship

## Status

Accepted

## Context

Dense Boards become difficult to scan when every card and Connection has the same visual weight. Thought Studio also serves both people and agents on one shared surface, so styling material as “human” or “agent” would divide a context that is meant to remain shared.

The product still begins with blankness. Semantic structure cannot become a form that must be completed before a thought can be placed.

## Decision

- A card may optionally declare one of four semantic roles: **Thought**, **Evidence**, **Question**, or **Decision**.
- A Connection may optionally declare one of six relationships: **Relates**, **Supports**, **Challenges**, **Depends on**, **Leads to**, or **References**.
- New notes and Connections receive quiet neutral defaults. Existing material without explicit semantics remains valid and can receive a reversible visual inference until a participant assigns meaning.
- Card role controls visual hierarchy. Participant identity does not create a separate card category.
- Authorship and agent scope remain provenance metadata and appear contextually rather than as persistent decorative styling.
- At overview zoom, the Board emphasizes frames, card roles, titles, and relationship shape. Detail and provenance return as the participant zooms in.
- A Source keeps its provenance kind while also declaring or inferring its material format: webpage, video, document, code, data, image, or file.
- The semantic colors use the canonical Thought Studio palette: Studio Blue for evidence and references, Sun for questions, Leaf for decisions and support, Vermilion for challenge, and Black/Chalk for neutral thought and relation.

## Consequences

- People and agents can read the same Board grammar without requiring a schema before creation.
- Dense Boards can communicate at multiple zoom levels.
- The data model remains backward compatible because semantic fields are optional.
- Provenance remains inspectable without making authorship the primary visual distinction.
