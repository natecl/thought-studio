# Interaction prototype foundation

- **Status:** Milestone 4E implemented
- **Date:** 2026-08-29
- **Initial input priority:** Desktop pointer and keyboard

## Purpose

This milestone turns the accepted Primary Play blank canvas into a real spatial surface without compromising the empty-board experience. A compact tool dock now makes implemented creation and navigation behavior manually discoverable.

## Implemented interaction model

| Intent | Pointer / trackpad | Keyboard |
| --- | --- | --- |
| Pan | Trackpad scroll; Space-drag; middle-button drag | Hold Space while dragging |
| Zoom | Control- or Command-scroll around the pointer | `+` / `-`; `0` resets the view |
| Choose Select | Select in the tool dock | `V` |
| Choose Pan | Pan in the tool dock | `H` |
| Choose Lasso | Lasso in the tool dock | `L` |
| Add text | Double-click; right-click → Add text | `T` |
| Add note | Right-click → Add note | `N` |
| Add URL Source | Paste a URL anywhere; Add Source in the tool dock or right-click menu | Command/Control-V |
| Add image or file Source | Drop files on the Board; Add Source → Choose an image or file | — |
| Add an empty Frame | Choose Frame, then drag a crop-like boundary; right-click → Add Frame uses a default size | `F`, then drag |
| Select one | Click an Object | Tab to an Object |
| Toggle selection | Shift-, Command-, or Control-click an Object | — |
| Select a rectangular area | Drag across empty Board space with Select | — |
| Select a freehand area | With Lasso, draw a loop around the Objects | `L`, then draw a loop |
| Select everything | — | Command/Control-A |
| Connect two entities | Select exactly two Board entities, then choose Connect in the selection toolbar | — |
| Create a Source fragment | Select a Source, then choose Note or Quote in its contextual toolbar | — |
| Ask an agent about bounded context | Select two or more Board entities with marquee, lasso, or Shift-click; choose Ask agent | — |
| Frame a selection | Select Objects, then choose Frame in the selection toolbar | `F` |
| Move | Drag any selected Object to move the selection | Arrow keys; Shift-arrow moves 10 px |
| Move a Frame | Drag the Frame boundary to move it and its contained Objects | Arrow keys; Shift-arrow moves 10 px |
| Resize a Frame | Drag any selected Frame's edge or corner handle | — |
| Edit | Double-click an Object | Enter |
| Rename a Frame | Double-click its title | Select it, then Enter |
| Finish editing | Click away | Command-Enter or Control-Enter |
| Duplicate | Use the multi-selection toolbar | Command/Control-D |
| Delete | Use the multi-selection toolbar | Delete or Backspace |
| Undo / redo | Context menu | Command/Control-Z; add Shift to redo |

## Behavior commitments

- A new Board still opens as a genuinely blank field.
- Text and Note are available from the compact tool dock and the contextual right-click menu.
- The tool dock contains no unavailable or speculative tools.
- Text and notes use the same underlying Board coordinate system and remain stable while panning or zooming.
- A URL can enter directly as a first-class Source with its normalized link, origin, import time, and a useful local preview. No external metadata service is required by this prototype slice.
- Images and files enter through the same Source model by dropping them onto the Board or choosing them from Add Source. Image Sources retain a visible preview; file Sources retain their name, media type, size, and original payload.
- This local prototype caps each embedded file at 1.5 MB and stores its payload in browser persistence. That is a temporary prototype boundary, not a storage architecture decision.
- Sources participate in selection, movement, framing, duplication, deletion, undo, and local persistence using the same Board entity model as manually authored material.
- A Connection begins as an intentionally non-semantic visual relationship between two selected Board entities. It follows both endpoints, can be selected directly, and becomes Studio Blue only when selected.
- Connections persist, duplicate with both endpoints, delete with a removed endpoint, and participate in meaningful undo and redo operations.
- Selecting a Source exposes quiet Note and Quote actions. The resulting fragment retains the live Source identity plus a durable title, origin, and URL snapshot.
- Linked fragments can locate an existing Source on the Board. If that Source is removed, the fragment keeps its original provenance and external link rather than losing lineage.
- Multiple fragments from one Source form a vertical trail beside it instead of overlapping.
- A multi-selection can become explicit agent context through Ask agent. The request stays anchored to that visible selection rather than opening a generic chat sidebar.
- Studio agent creates a persisted Draft Proposal beside the selected material. The Proposal names its scoped Object count and retained Source count without changing the original Board state.
- Accepting a Proposal creates an attributed agent Note with a durable scope and Source snapshot. Rejecting removes the Proposal; both decisions are meaningful undoable operations.
- The current response is a deterministic local workflow preview. It proves scope, proposal, attribution, provenance, review, and reversal mechanics without selecting an AI model, provider, or execution backend.
- Object creation, editing, movement, and deletion are meaningful undoable operations.
- Multi-selection has one shared boundary and one contextual toolbar while preserving each Object's individual identity.
- Selected Objects move, nudge, duplicate, and delete as one reversible operation.
- Marquee selection uses forgiving intersection. Lasso selection follows the freehand loop the participant draws and includes Objects whose visual centers fall inside it.
- The lasso renders only the participant's pointer trail while drawing; its inferred closing edge is never shown across the middle of the loop.
- A Frame is a first-class context boundary with a title, spatial bounds, and explicit Object membership.
- Creating a Frame around selected Objects reassigns them from any previous Frame; nested Frames are deferred.
- Moving or duplicating a Frame includes its contained Objects. Removing a Frame preserves those Objects on the Board.
- Frame placement begins as an adjustable crop-like rectangle. A selected Frame exposes four edge and four corner handles; resizing changes the context boundary without scaling contained Objects.
- Directly dragging an Object into or out of a Frame updates its membership to match the visible spatial model.
- Finishing a Frame placement or resize reconciles membership from each Object's visual center so the visible boundary and stored context agree.
- Board items persist locally across reloads for this prototype milestone.
- The implementation uses the selected brand tokens and exact Thought Bloom asset.

## Deliberately deferred

- Rotation handles
- Ink and erasing
- Shapes and semantic Connection labels
- Automatic extraction, transcription, and quotation detection
- Server persistence and synchronization
- Multiplayer presence
- Live agent execution, streaming activity, and model/provider integration
- Agent permissions, pause controls, roles, and multiplayer presence

The next milestone should validate this stable Board-facing proposal contract with a real agent adapter while preserving visible scope, retained provenance, explicit review, and meaningful reversal.
