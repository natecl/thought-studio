# Thought Studio

> Bring whiteboarding back.

Thought Studio is an agent-native digital whiteboard where people, information, and AI agents think together in one shared spatial workspace.

The product begins with a blank board. People can write, draw, paste sources, invite collaborators, and bring in agents. Fragments gradually become connections, systems, and creations without forcing structure before understanding exists.

## Product thesis

AI made generation abundant, but it made thinking increasingly invisible. Thought Studio restores the shared construction of understanding: placing ideas beside one another, seeing relationships, challenging assumptions, and gradually forming a system.

The board is not a feature. The board is the product and the operating environment.

## Status

The product foundation remains docs-first, and the first interaction prototype is now underway. The repository includes a responsive localhost workspace shell based on the accepted Primary Play visual system.

The application is implemented in React and strict TypeScript. JavaScript source files are disabled by the TypeScript configuration.

## Run the workspace locally

Requirements: Node.js and npm.

```bash
npm install
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173/`).

Create a production build with:

```bash
npm run build
```

Run the TypeScript compiler without producing output with:

```bash
npm run typecheck
```

### Current implementation milestone

- Native full-viewport Chalk canvas with the accepted micro-dot field
- Collapsible workspace sidebar with Pinned, Recents, and Projects
- Responsive Board tool dock for implemented creation and view controls
- Exact selected Thought Bloom logo asset
- Functional multi-Board navigation and local per-Board persistence
- Exclusive Pinned placement with retained Project ownership
- Pan and zoom across a shared Board coordinate system
- Contextual text and note creation
- Universal URL Sources through paste or manual entry, with retained origin and import provenance
- Image and file Sources through drag-and-drop or file choice, with attached browser-local originals
- Simple visual Connections between selected Board entities that follow their endpoints
- Source-linked notes and quotations with durable origin snapshots and on-Board Source location
- Single and multi-selection with Shift-click, marquee, and freeform lasso
- Collective dragging, keyboard nudging, duplication, and deletion
- First-class Frames with naming, explicit membership, collective movement, and duplication
- Undo and redo for meaningful Object operations
- Local Board-item persistence across reloads

See the [interaction prototype foundation](docs/design/INTERACTION_PROTOTYPE.md) for the complete input model. Bounded agent participation is the next interaction milestone. The approved mockup is a visual reference; the coded interface is the product implementation.

## Start here

1. [Product context](docs/PRODUCT_CONTEXT.md)
2. [Vision](docs/VISION.md)
3. [Product principles](docs/PRODUCT_PRINCIPLES.md)
4. [Product requirements](docs/PRD.md)
5. [Core object model](docs/CORE_MODEL.md)
6. [Blank canvas foundation](docs/design/WHITEBOARD_FOUNDATION.md)
7. [Ten modern blank canvas directions](docs/design/BLANK_CANVAS_DIRECTIONS.md)
8. [Visual identity foundation](docs/design/BRAND_FOUNDATION.md)
9. [Ten artistic brand directions](docs/design/ARTISTIC_BRAND_DIRECTIONS.md)
10. [Interaction prototype foundation](docs/design/INTERACTION_PROTOTYPE.md)
11. [Agent experience](docs/AGENT_EXPERIENCE.md)
12. [Initial roadmap](docs/ROADMAP.md)

The documentation index is in [docs/README.md](docs/README.md).

## Founding commitments

- Blankness is sacred.
- Structure emerges after thought.
- Spatial arrangement carries meaning.
- AI participates visibly; it does not silently seize control.
- Any useful material can enter the board.
- Every meaningful contribution retains its lineage.
- Beauty and utility are coequal product requirements.

## Initial product promise

Start with nothing. Bring in anything. Think with humans and agents. Leave with a system or creation you understand.
