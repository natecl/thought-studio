# ADR 0001: The whiteboard is the product

- **Status:** Accepted
- **Date:** 2026-08-28

## Context

The broad opportunity includes learning, search, communication, work, creation, and agent collaboration. A product spanning those areas could easily become a collection of disconnected modules or a chat application with supplemental visual tools.

The founding insight is that physical whiteboarding provides a distinctive behavior: people begin without structure and gradually externalize fragments, relationships, and systems in a shared spatial model.

## Decision

The Board will be the primary product environment and the organizing center for all core behavior.

- Documents, videos, webpages, images, files, and connected applications enter as board material or Sources.
- Human and agent collaboration occurs on the Board.
- Chat or instruction interfaces are subordinate interaction methods, not separate product centers.
- Creations derive from Board material and preserve lineage back to it.
- Product expansion should occur through composable Board primitives rather than independent workflow modules.

## Consequences

### Positive

- The product has one coherent behavioral center.
- Learning, understanding, design, architecture, and creation can share primitives.
- Human and agent participants can operate on the same visible context.
- Integrations add value without fragmenting the workspace.
- The product can develop a distinctive interaction and aesthetic language.

### Costs and constraints

- The Board must support both freeform expression and durable structured context.
- Navigation, performance, accessibility, and clutter management become foundational challenges.
- Rich outputs may require specialized editing while remaining connected to the Board.
- Teams must resist feature requests that create competing centers of gravity.

## Rejected alternatives

### Chat-first product with a canvas

Rejected because it preserves prompting as the dominant behavior and makes the spatial model secondary.

### Document-first workspace with whiteboard blocks

Rejected because it requires spatial thought to live inside a linear hierarchy.

### Collection of workflow-specific canvases

Rejected for the initial product because hard-coded learning, strategy, research, and planning products would undermine the shared primitive system.
