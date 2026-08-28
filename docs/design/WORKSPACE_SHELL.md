# Workspace shell

- **Status:** Sidebar direction v0.1 implemented for review
- **Date:** 2026-08-28
- **Scope:** Navigation around the Board; not Board creation tools

## Purpose

The workspace shell lets a person move between Boards without turning navigation into a competing product surface. The Board remains the place where thinking happens; the shell only provides orientation and access.

## Sidebar direction

The first sidebar prototype uses a deliberately shallow hierarchy:

1. Static Thought Studio brand anchor
2. New Board and search
3. Pinned Boards
4. Recent Boards
5. Projects containing Boards
6. Account access

Pinned and Recent are views of Boards, not separate containers. A Project is a lightweight shell-level grouping for Boards. It does not introduce a new canvas, object model, or place where work occurs.

A pinned Board has one visible sidebar location: Pinned. It is hidden from both Recents and its Project list while pinned. Its Project relationship remains in Board metadata, so unpinning returns it to that Project without changing ownership or organization.

## Relationship to the Board tool dock

The sidebar answers **where can I go?** The floating tool dock answers **what can I do on the Board?** The former identity bar was removed because it repeated the Thought Studio mark and Board title already represented by the shell.

The tool dock exposes only implemented behavior: Select, Pan, Text, Note, Undo, Redo, and view controls. When the sidebar opens on desktop, the dock remains centered in the available Board area. When the sidebar closes, the Board returns to the full viewport. On smaller viewports, the sidebar becomes a temporary overlay and the essential tool dock moves to the bottom edge.

## Visual source of truth

The shell uses the accepted [Primary Play visual identity](BRAND_FOUNDATION.md) and its machine-readable [`brand/tokens.json`](brand/tokens.json):

- Chalk is the dominant shell and Board ground.
- Black carries structure and utility information.
- Studio Blue appears only as restrained orientation for the active Board and focus states.
- Bricolage Grotesque carries identity; Atkinson Hyperlegible carries navigation and metadata.
- The selected Thought Bloom asset is used without redrawing or altering its silhouette.
- Hairlines, compact radii, and quiet lift preserve the calm digital material character.

The Codex application is an information-architecture reference only. Its purple palette, density, component styling, and product-specific controls are not visual references.

## Prototype behavior

- Collapse and reopen the sidebar.
- Search across the prototype Board list.
- Expand and collapse Projects.
- Pin a Board into a single visible Pinned location while preserving its hidden Project membership; unpinning restores its Project and Recent appearances as appropriate.
- Create a new local Board with `Command/Control-N`.
- Switch between local Boards while preserving their Board material independently.
- Collapse the sidebar automatically after choosing a Board on a small viewport.

## Next review

Review this sidebar before composing the remaining shell states:

1. Workspace Home with navigation expanded
2. Board open with navigation collapsed
3. Board open with navigation expanded
4. Board open with a contextual inspector

Workspace and Project remain shell-level product hypotheses until this direction is accepted and captured in a decision record.
