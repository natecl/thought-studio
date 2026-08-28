# Working context for agents

This repository defines Thought Studio, an agent-native whiteboard. Read this file before changing product documentation or implementation.

## Required reading order

1. `README.md`
2. `docs/PRODUCT_CONTEXT.md`
3. `docs/VISION.md`
4. `docs/PRODUCT_PRINCIPLES.md`
5. `docs/PRD.md`
6. The document relevant to the task

## Non-negotiable product truths

- The whiteboard is the product, not a feature attached to documents or chat.
- The default experience begins with an unstructured blank board.
- Structure must be allowed to emerge from thought rather than being required beforehand.
- Human and agent activity happens on the same shared spatial surface.
- Agent work must be visible, attributable, scoped, and reversible.
- Sources, thoughts, connections, and outputs must retain provenance.
- Integrations provide material to the board; they do not become separate product centers.
- Beauty, tactility, calm, speed, and utility are functional requirements.

## Product language

Prefer the canonical terms in `docs/GLOSSARY.md`. In particular:

- A **Board** is the shared spatial environment.
- A **Frame** is a bounded region with a purpose.
- A **Participant** can be a person or agent.
- A **Source** is external material with provenance.
- A **Creation** is a deliberate output formed from board material.

## Decision discipline

- Do not introduce a technical stack as settled unless an accepted decision record does so.
- Capture consequential product or architecture choices in `docs/decisions/`.
- Distinguish committed requirements from hypotheses and open questions.
- Preserve the broad vision while keeping the first product behavior narrow and testable.

## Current milestone

Define and validate the smallest experience that proves this loop:

`blankness -> fragments -> connections -> system -> creation`
