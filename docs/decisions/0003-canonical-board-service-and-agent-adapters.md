# ADR 0003: One canonical Board service with agent-facing adapters

- **Status:** Accepted
- **Date:** 2026-08-29

## Context

Thought Studio needs to let the visible application, local automation, and external agents work with the same Boards. If the canvas, a command-line interface, and an MCP server each implement their own mutation behavior, the machine-readable context will diverge from what people can see and manipulate.

The current interaction prototype stores Board state in the browser. That is appropriate for validating direct manipulation, but browser-local state is not a safe or durable integration boundary for external participants.

The first agent-facing implementation also needs to preserve Thought Studio's existing trust requirements: visible identity, explicit scope, provenance, review, and reversibility. It should not prematurely select a hosted database, authentication provider, deployment platform, or synchronization architecture.

## Decision

Thought Studio will define one framework-independent TypeScript Board service as the canonical application boundary.

The service owns:

- Board creation and retrieval
- Board- and Frame-scoped context reads
- Validated Board operations
- Optimistic version checks
- Idempotency handling
- Participant attribution
- Proposal creation, acceptance, and rejection
- Meaningful activity history
- Permission checks against a trusted Participant principal

Repositories persist the service's Board aggregate behind an interface. The first implementation includes in-memory and local JSON-file repositories for tests and local development; this does not settle the hosted persistence architecture.

The canvas, CLI, future HTTP API, and future MCP server will be adapters over the same service and operation model:

```text
Canvas UI ──┐
CLI ────────┼── Board service ── Board repository
MCP server ─┘
```

An agent-created Board belongs to a workspace or Project. The creating agent is recorded as the attributed Participant; it does not receive a separate hidden Board model or ownership silo.

External agents may create and read Boards and propose scoped changes when granted those capabilities. Direct Apply requires an explicit write capability. Reviewing a proposal requires a separate review capability. Propose remains the default mutation mode for agents.

Board operations are typed, validated, attributable, versioned, and idempotent. Adapters must not write repository records or raw Board JSON directly.

## Initial adapter surface

The first CLI proves the service contract with these workflows:

- Create and list Boards
- Inspect Board or Frame context
- Propose a batch of Board operations
- Accept or reject a proposal

The later MCP adapter will expose readable Board and Frame context as Resources and the same service commands as Tools. Local clients may use stdio; hosted clients may use the protocol's remote HTTP transport. Transport details remain outside the domain service.

## Consequences

### Positive

- People, native agents, external agents, and automation use the same visible entity model.
- MCP and CLI behavior cannot silently drift from canvas behavior when all adapters use the same service.
- Agent changes retain identity, scope, provenance, review state, and history.
- Optimistic versions and idempotency keys make retries and concurrent automation safer.
- Hosted storage, real-time synchronization, and authentication can be selected later without rewriting agent tools.

### Costs and constraints

- Existing browser-local canvas persistence must migrate behind the service in a later slice.
- The first local repositories are development boundaries, not production durability guarantees.
- Permission principals passed to the local CLI are trusted development inputs; a remote adapter must derive them from authenticated credentials rather than caller-supplied claims.
- Real-time presence and multiplayer conflict resolution require later decisions beyond optimistic aggregate versions.

## Rejected alternatives

### MCP as the application backend

Rejected because MCP is an interoperability adapter. Product behavior, permissions, and persistence must remain usable by the canvas and other clients without speaking MCP internally.

### CLI commands that edit Board JSON directly

Rejected because direct file mutation bypasses validation, provenance, version checks, permissions, and meaningful history.

### A separate agent knowledge store

Rejected because it would create hidden context that people cannot inspect on the Board.

### Direct Apply as the default agent mode

Rejected because it conflicts with visible, controllable, and reversible agent participation.
