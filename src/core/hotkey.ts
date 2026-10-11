/** Whether "mod" means ⌘ rather than Ctrl. */
const isMac = (): boolean =>
  typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

/**
 * `event.code` for the keys a spec can name, so an Alt combo can be matched by
 * physical key. Letters and digits are derived; these are the rest.
 */
const KEY_CODES: Record<string, string> = {
  ".": "Period",
  ",": "Comma",
  "/": "Slash",
  "\\": "Backslash",
  ";": "Semicolon",
  "'": "Quote",
  "[": "BracketLeft",
  "]": "BracketRight",
  "-": "Minus",
  "=": "Equal",
  "`": "Backquote",
  " ": "Space",
  space: "Space",
};

const codeFor = (key: string): string | undefined => {
  if (/^[a-z]$/.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return KEY_CODES[key];
};

/** Parse a hotkey string like "mod+." into a matcher predicate. */
export function matchHotkey(spec: string, e: KeyboardEvent): boolean {
  const parts = spec
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return false;

  const key = parts[parts.length - 1];
  const mods = new Set(parts.slice(0, -1));

  const mac = isMac();

  const wantMeta = mods.has("meta") || mods.has("cmd") || (mods.has("mod") && mac);
  const wantCtrl = mods.has("ctrl") || mods.has("control") || (mods.has("mod") && !mac);
  const wantShift = mods.has("shift");
  const wantAlt = mods.has("alt") || mods.has("option");

  if (e.metaKey !== wantMeta) return false;
  if (e.ctrlKey !== wantCtrl) return false;
  if (e.shiftKey !== wantShift) return false;
  if (e.altKey !== wantAlt) return false;

  if (e.key.toLowerCase() === key) return true;

  // With \u2325 held, macOS hands the browser the composed character \u2014 \u2325\u21e7D
  // arrives as "\u00ce", not "d" \u2014 so an Alt combo has to be matched by physical
  // key instead. Only when Alt is wanted: `code` ignores the layout, and
  // matching it everywhere would fire \u2318+a for \u2318+q on AZERTY.
  return wantAlt && e.code === codeFor(key);
}

/**
 * The shortcut the dock listens for when `hotkey` is left unset: ⌥⇧D on Mac,
 * Alt+Shift+D elsewhere.
 *
 * Deliberately off the beaten path. ⌘/Ctrl combos are the contested space —
 * ⌘K is Firefox's search bar and most apps' own palette, ⌘⇧I is devtools,
 * ⌘. is "cancel" in some Mac apps — while Alt+Shift+letter is claimed by
 * neither the browser chrome nor the OS, and an app's own bindings rarely
 * reach for it.
 */
export const DEFAULT_HOTKEY = "alt+shift+d";

const MAC_SYMBOL: Record<string, string> = {
  meta: "⌘",
  cmd: "⌘",
  ctrl: "⌃",
  control: "⌃",
  shift: "⇧",
  alt: "⌥",
  option: "⌥",
};

const PC_NAME: Record<string, string> = {
  meta: "Win",
  cmd: "Win",
  ctrl: "Ctrl",
  control: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  option: "Alt",
};

/**
 * Human-readable form of a hotkey spec — "⌥⇧D" on Mac, "Alt+Shift+D"
 * elsewhere.
 */
export function formatHotkey(spec: string): string {
  const parts = spec
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return "";

  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  const mac = isMac();

  const label = key.length === 1 ? key.toUpperCase() : key;
  const shown = mods.map((m) =>
    mac
      ? (MAC_SYMBOL[m] ?? (m === "mod" ? "⌘" : m))
      : (PC_NAME[m] ?? (m === "mod" ? "Ctrl" : m)),
  );

  // Mac stacks the glyphs (⌘⇧K); everywhere else they're joined with "+".
  return mac ? [...shown, label].join("") : [...shown, label].join("+");
}
