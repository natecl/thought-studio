# Agent experience

**Status:** Foundational interaction hypothesis

## Principle

Agents inhabit the board as visible participants. They should not operate primarily as hidden chat processes that return detached outputs.

## What agent-native means

An agent-native board provides agents with:

- A visible identity and presence
- A defined spatial scope
- Access to permitted board context and sources
- Tools for creating, annotating, connecting, and proposing changes
- A history of attributed actions
- A way to ask for clarification on the board
- A way for people to interrupt, redirect, accept, or reject work

## Core invocation patterns

### Lasso and ask

The user selects a region or objects and gives an instruction such as:

- Organize these thoughts.
- Find the underlying question.
- Challenge the assumptions in this frame.
- Identify missing evidence.
- Connect this material to another area.
- Turn this system into an outline.

The selection defines default context and scope.

### Assign a frame

The user assigns an agent a bounded Frame with a goal, tools, sources, and permissions. The agent works visibly within or beside that Frame.

### Place an agent

The user adds an agent to the board as a participant and gives it an ongoing role, such as researcher, critic, architect, facilitator, or synthesizer.

### Agent-to-agent collaboration

One agent can request work from another when permitted. Delegation should be visible as a relationship between identities and assignments, not hidden inside an execution trace.

## Modes of change

Agents need at least two interaction modes:

1. **Propose:** place suggested material in a visually distinct state for human review.
2. **Apply:** make changes directly within an explicitly granted scope.

The default for destructive reorganization or broad spatial changes should be Propose.

## Visual behavior

Agent activity should be calm and comprehensible:

- A cursor or presence marker shows where the agent is working.
- New material appears incrementally or in understandable batches.
- Proposed changes are visually distinct without overwhelming the board.
- Source-backed contributions expose provenance on demand.
- Agent working notes can remain temporary until promoted.
- Large reorganizations show a preview or alternate arrangement.

## Human control

People must be able to:

- Pause or stop an agent
- Narrow or expand its scope
- Change allowed tools or sources
- Accept, reject, or edit a proposal
- Revert an applied operation
- Ask why an object or connection was created
- Distinguish observation, inference, and invention

## Multiplayer agents

Multiple agents should have distinct roles rather than producing an indistinguishable pile of generated material.

Example session:

- A researcher gathers source-backed material in one Frame.
- A critic identifies weaknesses and counterarguments in another.
- A systems architect proposes relationships between the findings.
- A human participant directs priorities and decides what becomes durable.
- A synthesizer helps create an output from accepted board material.

All participants share the same board state but may have different scopes and permissions.

## Trust requirements

- Every durable agent contribution has an identity.
- Source-dependent claims can reveal their provenance.
- Agent uncertainty is representable.
- Meaningful operations are reversible.
- Agents cannot silently read restricted board regions.
- Integrations respect the permissions of their source systems.

## Anti-patterns

- A generic chat sidebar as the primary AI experience
- Silent rearrangement of the user's spatial model
- Agents generating a finished artifact without showing contributing material
- Multiple agents with no visible identity or division of responsibility
- Agent output visually indistinguishable from user-authored thought
- Hidden context that materially affects results but cannot be inspected
