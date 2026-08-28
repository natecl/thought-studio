# Product requirements document

- **Product:** Thought Studio
- **Version:** 0.1
- **Status:** Draft for discovery
- **Date:** 2026-08-28

## 1. Summary

Thought Studio is an agent-native digital whiteboard where humans, information, and AI agents think together in one shared spatial workspace.

The first product must prove that users can begin without structure, bring disparate material into one board, develop a visible system with people or agents, and turn part of that system into a useful creation without losing provenance.

## 2. Problem statement

Complex thinking is fragmented across search, notes, chat, documents, whiteboards, and agent interfaces. Context is repeatedly transferred or lost. Existing AI interaction often hides the process of construction and reduces collaboration to prompting and receiving outputs.

Users need a continuous environment for moving from ambiguity to understanding and from understanding to creation.

## 3. Product hypothesis

If a digital whiteboard preserves the immediacy and spatial freedom of physical whiteboarding while making sources, collaboration, provenance, and agent activity native to the same space, then individuals and small teams will use it to understand and create complex work that currently spans multiple tools.

## 4. Goals

### Product goals

- Make starting from a blank state feel immediate and inviting.
- Support fluid progression from unstructured fragments to visible systems.
- Accept multiple source types as native board material.
- Enable useful collaboration between humans and visible agents.
- Let users turn a Frame into a deliberate creation.
- Preserve authorship, source lineage, and reversibility.
- Make the experience beautiful, tactile, calm, and fast.

### Validation goals

- Determine whether people prefer spatial agent collaboration to chat-only collaboration for ambiguous work.
- Identify the strongest initial audience and creation outcome.
- Learn how much agent autonomy users will grant inside a spatial model.
- Validate whether provenance increases trust without adding unacceptable visual complexity.

## 5. Non-goals for the first product

- Full project management
- General-purpose team messaging
- A complete replacement for Notion, browsers, or source applications
- A template marketplace
- Arbitrary autonomous computer-use workflows
- Enterprise administration beyond what is required for safe testing
- A broad catalog of specialized creation editors
- Automatic structuring of every board

## 6. Target users

### Initial persona: the system builder

An individual or small-team contributor who starts with an ambiguous question, gathers material from several places, discovers structure through spatial work, and needs to produce or explain something.

Examples include founders, product strategists, designers, researchers, consultants, systems architects, educators, and research-driven creators.

### Core needs

- A low-friction place to externalize incomplete thought
- A way to keep source material beside emerging ideas
- A way to see relationships and systems
- A way to involve collaborators without flattening the process into a document
- A way to direct AI while retaining authorship and understanding

## 7. Core user journey

1. The user creates a Board and sees a genuinely blank surface.
2. The user writes, draws, types, or pastes material immediately.
3. The user brings in at least one external Source.
4. The user arranges, groups, frames, and connects material.
5. The user invites a person or agent into the Board.
6. The participant adds, challenges, organizes, or connects material visibly.
7. The user identifies an emerging system or point of view.
8. The user converts a Frame into a Creation or export.
9. The Creation retains links to its originating material and contributors.

## 8. Functional requirements

Priorities use **P0** for the first testable product, **P1** for the next validation layer, and **P2** for later expansion.

### 8.1 Board and navigation

- **P0:** Create, name, open, and persist a Board.
- **P0:** Pan and zoom a large spatial surface smoothly.
- **P0:** Place and move material without entering a layout mode.
- **P0:** Select one or multiple entities, including freeform/lasso selection.
- **P0:** Undo and redo meaningful user and agent operations.
- **P1:** Navigate by Frames, search, minimap, and recent activity.
- **P1:** Replay or inspect meaningful Board history.

### 8.2 Direct expression

- **P0:** Create text and simple notes in place.
- **P0:** Draw and erase freehand ink.
- **P0:** Create simple shapes and visual connections.
- **P0:** Group and ungroup material without requiring semantic labels.
- **P1:** High-quality pen pressure, touch, and stylus behavior.
- **P1:** Preserve rough expression while offering optional cleanup.

### 8.3 Sources and embeds

- **P0:** Paste a URL and create a Source object with title, origin, preview, and link.
- **P0:** Add images and files as board material.
- **P0:** Attach extracted notes or quotations to their Source.
- **P1:** Rich YouTube object with timestamped references or transcript-derived material.
- **P1:** Notion document linking or import with permission-aware provenance.
- **P1:** Webpage and PDF extraction with stable references.
- **P2:** Live synchronization with supported source applications.

### 8.4 Spatial organization

- **P0:** Create and label a Frame around material.
- **P0:** Draw or create Connections between entities.
- **P0:** Move a Frame and its contained material coherently.
- **P1:** Apply optional semantic meaning to a Connection.
- **P1:** Save or switch Lenses without mutating underlying Board state.

### 8.5 Human collaboration

- **P0:** Share a Board with at least one other person in an editing session.
- **P0:** Show participant identity, presence, selection, and cursor.
- **P0:** Attribute durable contributions.
- **P1:** Comments or anchored discussion without turning the product into a chat feed.
- **P1:** Asynchronous activity summary and Board walkthrough.
- **P1:** Frame-level collaboration scope.

### 8.6 Agent participation

- **P0:** Invoke an agent on a selected region using a natural-language instruction.
- **P0:** Let the agent add text Objects and Connections in a bounded area.
- **P0:** Show agent identity and distinguish its contribution from human-authored material.
- **P0:** Display sources for source-backed agent contributions.
- **P0:** Stop an active agent operation and revert an applied operation.
- **P0:** Support a Propose mode for review before durable changes.
- **P1:** Assign an agent to a Frame with an ongoing role.
- **P1:** Permit multiple named agents with distinct roles.
- **P1:** Show visible agent-to-agent delegation.
- **P2:** Allow scoped external actions through connected tools.

### 8.7 Creation

- **P0:** Select a Frame and create a structured text output from its accepted material.
- **P0:** Preserve references from output sections to originating Board material.
- **P0:** Edit the output without breaking its association with the Board.
- **P1:** Support presentation, product brief, lesson, and essay-oriented Lenses or output formats.
- **P1:** Place a Creation back onto the Board as a connected entity.
- **P2:** Publish or synchronize Creations to external destinations.

### 8.8 Provenance and permissions

- **P0:** Record whether durable material was created by a person, agent, or import.
- **P0:** Preserve the origin of extracted source material.
- **P0:** Ensure an agent only receives context within its allowed scope.
- **P1:** Support Board- and Frame-level read/edit permissions.
- **P1:** Represent agent uncertainty and unsupported claims.
- **P2:** Support granular private regions and enterprise policy controls.

## 9. Experience requirements

### Blank-board experience

- A new Board must be usable without completing setup, choosing a template, or answering an AI prompt.
- The primary expression action should be discoverable within seconds.
- Product chrome should not visually compete with the surface.

### Performance

- Ink and direct manipulation should feel immediate.
- Pan and zoom should remain visually stable on representative hardware.
- Agent activity should not block local interaction.
- Large source previews should load progressively.

Exact performance budgets will be set after the interaction prototype establishes target platforms.

### Accessibility

- Core functionality must not depend solely on color, handwriting, or precise pointer control.
- Keyboard navigation and text alternatives must be designed alongside pointer and pen interaction.
- Collaboration and agent attribution must be perceivable through more than cursor color.

### Emotional quality

The product should feel:

- Calm rather than busy
- Tactile rather than form-driven
- Expressive rather than templated
- Intelligent rather than intrusive
- Alive rather than automated

## 10. First prototype scope

The first interactive prototype should demonstrate one complete loop:

1. Open a blank Board.
2. Add text, ink, an image, and a URL Source.
3. Move, group, connect, and Frame the material.
4. Lasso a region and ask an agent to identify themes or challenge assumptions.
5. Review visibly proposed additions.
6. Accept selected contributions.
7. Turn the Frame into a short structured Creation with source lineage.

Real-time multiplayer may be simulated or deferred in the earliest interaction prototype, but the object model and interface should anticipate participant identity.

## 11. Acceptance criteria for the first testable product

- A first-time user can add and spatially arrange material without instruction.
- The Board remains useful before any AI action occurs.
- A pasted Source is visually useful and can support traceable extracted material.
- An agent can operate on a user-selected scope without silently changing unrelated material.
- Users can distinguish and revert agent contributions.
- A Frame can become an editable structured output.
- At least one output statement can be traced back to Board material and its Source.
- The complete core journey can be demonstrated without leaving the Board environment.

## 12. Success signals

### Qualitative

- Users describe the Board as helping them think, not merely organize.
- Users continue manipulating agent material rather than accepting it as a finished answer.
- Collaborators can explain the emerging system after entering the Board.
- Users value seeing how an output was constructed.
- The blank state feels inviting rather than intimidating.

### Quantitative hypotheses

Initial research should establish baselines before targets are fixed. Candidate measures include:

- Time from new Board to first meaningful expression
- Percentage of sessions containing manual spatial manipulation
- Percentage of agent suggestions edited, connected, or selectively accepted
- Frames that become Creations
- Source-backed objects reused in more than one Frame or Creation
- Return rate to an existing Board
- Collaborative sessions in which multiple participants contribute to the same system

The primary metric should not be raw generated output volume.

## 13. Risks and mitigations

### The vision becomes an unfocused everything workspace

**Mitigation:** validate one end-to-end thinking-to-creation loop before broad integrations or workflow features.

### Infinite space becomes cognitive clutter

**Mitigation:** use Frames, focus modes, navigation, and progressive disclosure while preserving spatial freedom.

### Agent automation destroys spatial authorship

**Mitigation:** scope by selection or Frame, default broad changes to Propose, preview layout transformations, and make operations reversible.

### Rich sources overwhelm the surface

**Mitigation:** use layered previews and let detail unfold on demand.

### Provenance makes the experience feel technical

**Mitigation:** preserve lineage in the model but reveal it contextually rather than decorating every object with metadata.

### The product becomes a chat app with movable messages

**Mitigation:** make direct spatial manipulation, ink, material placement, and visible relationships primary in every core flow.

### Multiplayer agents create noise rather than leverage

**Mitigation:** require distinct roles, spatial scopes, identities, and review states.

## 14. Open product decisions

- Initial user and use case
- First Creation format
- Initial device and input priority
- Finite versus expandable/infinite Board boundaries
- Real-time multiplayer timing
- First rich integration
- Agent model and provider strategy
- Local-first, cloud-first, or hybrid persistence
- Representation of agent proposals and temporary working material
- Business model and packaging

## 15. Dependencies intentionally undecided

No frontend framework, canvas engine, synchronization model, database, AI provider, or hosting platform is selected by this PRD. Those choices should follow interaction prototyping and explicit architecture decisions.
