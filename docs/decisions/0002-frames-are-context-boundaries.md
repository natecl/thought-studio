# ADR 0002: Frames are first-class context boundaries

- **Status:** Accepted
- **Date:** 2026-08-29

## Context

Thought Studio must serve human spatial understanding and machine-readable context without maintaining two incompatible representations of the same work. A purely decorative Frame would help visual grouping but would not give collaborators or agents a reliable scope to read, move, query, or transform.

The first Frame milestone also needs to remain narrow. Nested containment, permissions, agent assignment, and Creation export are important, but implementing all of them before validating basic spatial framing would add premature structure.

## Decision

A Frame is a first-class persisted Board entity, not styling attached to a selection.

The initial Frame entity records:

- Identity
- Board position and dimensions
- Human-readable title
- Explicit child Object identities

The visible Board and future APIs will use this same entity and membership model.

Initial interaction semantics are:

- Creating a Frame around a selection records those Objects as its children.
- An Object has at most one direct Frame membership in this milestone.
- Directly dragging an Object into or out of a Frame updates membership to match visible containment.
- Placing a Frame is a crop-like drag gesture. A selected Frame can be resized from any edge or corner without scaling its contained Objects.
- Moving a Frame moves its contained Objects as one meaningful operation.
- Duplicating a Frame duplicates the Frame and its contained Objects.
- Removing a Frame preserves its contained Objects on the Board.
- Nested Frames are deferred rather than implicitly supported.

## Consequences

### Positive

- Humans and agents can refer to the same visible context boundary.
- Frame-scoped retrieval and agent work can be added without inventing a hidden context model.
- Spatial containment becomes durable and queryable while remaining directly manipulable.
- Frames can later become permission, collaboration, presentation, or Creation boundaries.

### Costs and constraints

- Membership must remain synchronized with direct manipulation.
- Moving and duplicating a Frame requires coherent operations over multiple entities.
- One direct parent is intentionally narrower than the long-term context graph may require.
- Nested containment, permissions, and agent assignment require later decisions.

## Rejected alternatives

### Decorative rectangle only

Rejected because agents and APIs could not reliably understand what the Frame contains.

### Separate hidden context collections

Rejected because the machine-readable model would diverge from what people can see and manipulate.

### Full nested graph containment immediately

Deferred because it would introduce ambiguous movement, selection, and permission behavior before the basic Frame loop is validated.
