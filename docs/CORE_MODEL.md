# Core conceptual model

**Status:** Initial hypothesis

The model should remain small, composable, and compatible with both freeform expression and machine-readable context.

## Primary objects

### Board

The shared spatial environment. A Board contains material, relationships, participants, and history. It may be private or shared.

Core properties:

- Identity and ownership
- Spatial coordinate system
- Participants and permissions
- Objects and relationships
- Version history
- Import and export boundaries

### Mark

The most direct expression on the board: freehand ink, highlight, gesture, or rough drawing. Marks should not require classification.

### Object

A placeable unit with identity. Initial object forms may include text, note, shape, image, embed, file, and group.

An Object can begin informally and acquire more structure later.

### Source

External or imported material with provenance. Examples include a YouTube video, webpage, Notion page, PDF, image, conversation, dataset, or code artifact.

A Source should preserve:

- Origin
- Creator when known
- Retrieval or import time
- Permission boundary
- Stable reference to extracted material
- Changes or synchronization state when applicable

The current interaction prototype implements the first universal Source slice for URLs. A pasted or manually entered web address becomes a persisted Board entity with a normalized original link, origin, import time, and local preview. It uses the same selection, movement, Frame membership, history, and persistence mechanics as other Board material without selecting a remote metadata provider or backend architecture.

### Connection

A relationship between two or more entities. A Connection may be purely visual or carry optional meaning such as supports, contradicts, depends on, derives from, or created by.

Semantic meaning should be additive; users can draw a line without naming its ontology.

### Frame

A bounded region of the board with a purpose. A Frame can represent a question, work area, system, presentation step, agent assignment, or creation boundary.

Frames provide focus inside a large spatial environment without dividing the board into separate applications.

The current prototype represents a Frame as a first-class persisted Board entity with a title, spatial bounds, and explicit child Object identities. This is the first implementation of a context boundary shared by the visible Board and future agent-facing APIs. Direct manipulation keeps membership synchronized with visible containment; nested Frames remain an open design question.

### Participant

An actor present on the board. A Participant may be a person or an agent and has identity, presence, capabilities, permissions, and activity history.

### Lens

A non-destructive way of interpreting or presenting board state. Examples include source lineage, chronology, semantic relationships, participant contributions, uncertainty, or presentation order.

### Creation

A deliberate output formed from board material. Examples include an essay, product brief, lesson, presentation, strategy, architecture description, or exported frame.

A Creation retains references to its originating board entities.

## Relationships

```text
Board
├── contains Marks, Objects, Sources, Connections, Frames, and Creations
├── hosts Participants
├── exposes Lenses
└── records History

Frame
├── bounds Board material
├── can scope a Participant or agent assignment
└── can become or contribute to a Creation

Creation
└── derives from Frames, Objects, Sources, Connections, and Participants
```

## Shared context graph

The visual board and the machine-readable context should describe the same underlying state. Agents should not require a separate hidden knowledge model that users cannot inspect.

The context graph may include:

- Spatial containment and proximity
- Explicit connections
- Source provenance
- Authorship and contribution
- Temporal order
- Frame purpose
- Optional semantic labels
- Permissions and visibility

The graph should enrich the whiteboard without forcing the whiteboard to look like a graph editor.

## History and reversibility

The system should distinguish:

- Direct human changes
- Direct agent changes
- Agent proposals not yet applied
- Imported source updates
- System-generated layout or formatting changes

Users should be able to inspect and reverse a meaningful operation without replaying every low-level pointer movement.

## Permissions hypothesis

Permissions may eventually exist at Board, Frame, Source, and agent-assignment levels. The first version should avoid a complex matrix, but the data model should not assume every participant can read or modify everything.

## Model questions

- Is Mark a distinct persistent type or simply a low-structure Object?
- Does Creation live on the board, outside it, or both?
- How are embedded sources synchronized without violating user expectations?
- Which spatial relationships should agents infer automatically?
- How should temporary agent working material differ from durable board material?
