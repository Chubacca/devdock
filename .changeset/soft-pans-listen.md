---
"@chuvenger/devdock": minor
---

dock: default the toggle hotkey to `alt+shift+d` (⌥⇧D on Mac)

The dock now claims a shortcut without being asked. Alt+Shift+letter keeps it
off the contested ⌘/Ctrl ground — ⌘K is Firefox's search bar and most apps'
own palette, ⌘⇧I is devtools — so the default doesn't take a key something
else already wanted. Rebind with `hotkey`, or pass `hotkey: null` for no key at
all.

`matchHotkey` now falls back to `event.code` for Alt combos, since macOS hands
the browser the composed character (⌥⇧D arrives as "Î", not "d").

Because the default is deliberately unguessable, the popup's heading names it:
a `<kbd>` on the right, styleable as the new `hotkeyHint` part
(`.devdock-hotkey-hint`), hidden when `hotkey` is `null`. The floating button's
tooltip names it too, for when the popup is shut. `formatHotkey(spec)` and
`DEFAULT_HOTKEY` are exported for rendering a hint of your own.

One note for themers: `.devdock-title` is now `display: flex` (it holds the
title and the hint), where before it was a plain block of text.
