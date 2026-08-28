# Interaction prototype foundation

- **Status:** Milestone 1 implemented
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
| Add text | Double-click; right-click → Add text | `T` |
| Add note | Right-click → Add note | `N` |
| Select | Click an Object | Tab to an Object |
| Move | Drag an Object | Arrow keys; Shift-arrow moves 10 px |
| Edit | Double-click an Object | Enter |
| Finish editing | Click away | Command-Enter or Control-Enter |
| Delete | Select, then Delete | Delete or Backspace |
| Undo / redo | Context menu | Command/Control-Z; add Shift to redo |

## Behavior commitments

- A new Board still opens as a genuinely blank field.
- Text and Note are available from the compact tool dock and the contextual right-click menu.
- The tool dock contains no unavailable or speculative tools.
- Text and notes use the same underlying Board coordinate system and remain stable while panning or zooming.
- Object creation, editing, movement, and deletion are meaningful undoable operations.
- Board items persist locally across reloads for this prototype milestone.
- The implementation uses the selected brand tokens and exact Thought Bloom asset.

## Deliberately deferred

- Multi-selection and lasso
- Resize and rotation handles
- Ink and erasing
- Shapes, Connections, and Frames
- Image and URL Sources
- Server persistence and synchronization
- Multiplayer presence
- Agent selection and proposal workflows

The next milestone should add multi-selection and Frames before Sources or agent participation so spatial organization remains primary.
