# Interaction prototype foundation

- **Status:** Milestone 4A implemented
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
| Add an empty Frame | Choose Frame, then drag a crop-like boundary; right-click → Add Frame uses a default size | `F`, then drag |
| Select one | Click an Object | Tab to an Object |
| Toggle selection | Shift-click an Object | — |
| Select a rectangular area | Drag across empty Board space with Select | — |
| Select a freeform area | Draw around Objects with Lasso | `L`, then draw |
| Select everything | — | Command/Control-A |
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
- Sources participate in selection, movement, framing, duplication, deletion, undo, and local persistence using the same Board entity model as manually authored material.
- Object creation, editing, movement, and deletion are meaningful undoable operations.
- Multi-selection has one shared boundary and one contextual toolbar while preserving each Object's individual identity.
- Selected Objects move, nudge, duplicate, and delete as one reversible operation.
- Marquee selection uses forgiving intersection; freeform lasso uses each Object's visual center.
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
- Shapes and Connections
- Image and file Sources
- Server persistence and synchronization
- Multiplayer presence
- Agent selection and proposal workflows

The next milestone should add simple Connections between Board entities so imported context can become an explicit visible system before agent participation.
