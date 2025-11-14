# (re)Mix – AI Maintainer Guide

This document gives high-level context for AI agents that need to work on the
(re)Mix codebase. It summarizes how the main pieces fit together and highlights
common extension points so future changes can be scoped quickly.

## Project layout

| Path | Purpose |
| --- | --- |
| `index.html` | Static shell for the web app. Defines all UI markup and loads the main JavaScript module. |
| `styles.css` | All styling. No pre/post-processing. |
| `javascript.js` | Entry point that wires the Three.js scene, UI events, part loading, and manipulation tools. |
| `src/config.js` | Shared configuration constants (grid sizing, stacking tolerances, etc.). |
| `src/dom-elements.js` | Centralized DOM lookups and default ARIA state initialization. Imported once and destructured in `javascript.js`. |
| `src/geometry/normals.js` | Pure helpers for ensuring geometry normals face outward. Used during part import. |

> **Tip:** The code is intentionally split so that any additional helpers can be
> dropped into `src/` without editing the HTML. New modules can be imported from
> `javascript.js` like the existing ones.

## Runtime architecture

* **Scene bootstrapping** – `javascript.js` creates the Three.js renderer, scene,
  camera, lighting, and transform controls. Scene helpers for the floor and grid
  are defined near the top of the file.
* **State containers** – Plain variables grouped by concern:
  * Grid/snapping configuration (`gridCellSize`, `translationSnapHorizontal`, etc.).
  * Selection (`selectedMeshes`, `selectionTransformAnchor`).
  * Undo history (`history`, `historyIndex`).
  * Interaction flags (`isAdvancedMode`, `isMeasureMode`, etc.).
* **UI bindings** – DOM listeners appear close to their feature logic:
  * Sidebar + help overlay controls.
  * Import/export button handlers.
  * Transform gizmo setup and keyboard shortcuts.
* **Library loading** – `extractPartsFromObject`, `addPartInstance`, and related
  helpers manage the parts list and placement. Normals are corrected via the
  `fixNormalsForGeometry` helper exported from `src/geometry/normals.js`.
* **History system** – `pushHistory`, `undo`, and `redo` serialize scene state
  and rebuild meshes on demand. `serializeState` and `loadState` are the main
  extension points if new per-part metadata is introduced.
* **Measurement tool** – Controlled by `isMeasureMode` and lives near the end of
  the file. Toggle through the advanced mode panel or the `M` shortcut.

## Working effectively

1. **Import DOM refs** – New UI pieces should be added to
   `src/dom-elements.js`. This keeps lookup logic consistent and allows the main
   module to destructure the new reference alongside existing ones.
2. **Keep helpers pure where possible** – Utility functions that do not depend
   on scene state belong in `src/`. The normals helper illustrates how to keep
   shared math isolated for re-use.
3. **History awareness** – Any mutating feature should call `pushHistory()` once
   the mutation is final so undo/redo stays in sync.
4. **Selection safety** – Always guard against `selectedMeshes.size === 0` when
   manipulating selections. Helper functions such as `updateSelectionTransformAnchor`
   and `syncAdvancedPanelFromSelection` already do this.
5. **Testing manually** – No automated tests exist. When modifying behaviour,
   run the app with a local static server (`npx serve .`) and walk through part
   import, manipulation, grid snapping, stacking, and measurement workflows.

## Adding new functionality

* **New keyboard shortcuts** – Add the listener to the global `keydown` handler
  near the bottom of `javascript.js`. Update the help overlay in `index.html` if
  the shortcut should be documented.
* **Custom per-part data** – Extend the metadata stored in `mesh.userData` when
  creating parts. Make sure the data survives `serializeState` / `loadState`.
* **Export options** – All STL export logic resides near the `exportStlBtn`
  listener. Hook additional file formats there and update the UI labels.

## Glossary

* **Stacking mode** – Automatically rests new parts on top of existing ones
  based on bounding-box collision tests. Sensitive to the constants in
  `src/config.js`.
* **Grid snap** – Forces translate/rotate values to user-configured steps when
  the transform gizmo is used.

---

This guide should give future agents enough context to dive into specific
features quickly. Keep it updated whenever new modules or major flows are added.
