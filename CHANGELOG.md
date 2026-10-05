# @chuvenger/devdock

## 0.1.3

### Patch Changes

- 4747dbd: dock: fix rows not responding to real mouse clicks
  
  Each row re-rendered the whole list on `mouseenter`, which replaced the node
  under the pointer — so the browser kept rebuilding the list at frame rate while
  the pointer rested over it, and `mousedown`/`mouseup` landed on different nodes,
  meaning no `click` was ever dispatched on the row. Clicking a row with a real
  mouse did nothing; keyboard navigation was unaffected. `renderList()` now reuses
  the existing row nodes when the item list is unchanged, and hover/arrow
  navigation only repaints the highlight. Arrow keys also scroll the active row
  into view.

## 0.1.2

### Patch Changes

- fe6aebb: react-router adapter: import from `react-router` instead of `react-router-dom`
  
  React Router 8 dropped the `react-router-dom` package (there is no 8.x of it),
  so `@chuvenger/devdock/react-router` failed to resolve `useNavigate` and
  `UNSAFE_DataRouterContext` on v8. Both symbols have been exported from the
  `react-router` core package since v6, so the adapter now imports from there and
  works unchanged on v6, v7 and v8. The optional peer dep is now `react-router`
  (`>=6`) rather than `react-router-dom`.

## 0.1.1

### Patch Changes

- 8600e72: Add npm version and license badges to the README.
