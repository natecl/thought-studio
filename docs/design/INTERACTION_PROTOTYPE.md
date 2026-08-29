# Interaction prototype foundation

- **Status:** Milestone 2 implemented
- **Date:** 2026-08-28
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
| Select one | Click an Object | Tab to an Object |
| Toggle selection | Shift-click an Object | — |
| Select a rectangular area | Drag across empty Board space with Select | — |
| Select a freeform area | Draw around Objects with Lasso | `L`, then draw |
| Select everything | — | Command/Control-A |
| Move | Drag any selected Object to move the selection | Arrow keys; Shift-arrow moves 10 px |
| Edit | Double-click an Object | Enter |
| Finish editing | Click away | Command-Enter or Control-Enter |
| Duplicate | Use the multi-selection toolbar | Command/Control-D |
| Delete | Use the multi-selection toolbar | Delete or Backspace |
| Undo / redo | Context menu | Command/Control-Z; add Shift to redo |

## Behavior commitments

- A new Board still opens as a genuinely blank field.
- Text and Note are available from the compact tool dock and the contextual right-click menu.
- The tool dock contains no unavailable or speculative tools.
- Text and notes use the same underlying Board coordinate system and remain stable while panning or zooming.
- Object creation, editing, movement, and deletion are meaningful undoable operations.
- Multi-selection has one shared boundary and one contextual toolbar while preserving each Object's individual identity.
- Selected Objects move, nudge, duplicate, and delete as one reversible operation.
- Marquee selection uses forgiving intersection; freeform lasso uses each Object's visual center.
- Board items persist locally across reloads for this prototype milestone.
- The implementation uses the selected brand tokens and exact Thought Bloom asset.

## Deliberately deferred

- Resize and rotation handles
- Ink and erasing
- Shapes, Connections, and Frames
- Image and URL Sources
- Server persistence and synchronization
- Multiplayer presence
- Agent selection and proposal workflows

The next milestone should add Frames before Sources or agent participation so spatial organization remains primary.
