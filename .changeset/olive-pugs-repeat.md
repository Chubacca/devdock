---
"@chuvenger/devdock": patch
---

dock: fix rows not responding to real mouse clicks

Each row re-rendered the whole list on `mouseenter`, which replaced the node
under the pointer — so the browser kept rebuilding the list at frame rate while
the pointer rested over it, and `mousedown`/`mouseup` landed on different nodes,
meaning no `click` was ever dispatched on the row. Clicking a row with a real
mouse did nothing; keyboard navigation was unaffected. `renderList()` now reuses
the existing row nodes when the item list is unchanged, and hover/arrow
navigation only repaints the highlight. Arrow keys also scroll the active row
into view.
