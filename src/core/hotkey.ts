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

  const isMac =
    typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

  const wantMeta = mods.has("meta") || mods.has("cmd") || (mods.has("mod") && isMac);
  const wantCtrl = mods.has("ctrl") || mods.has("control") || (mods.has("mod") && !isMac);
  const wantShift = mods.has("shift");
  const wantAlt = mods.has("alt") || mods.has("option");

  if (e.metaKey !== wantMeta) return false;
  if (e.ctrlKey !== wantCtrl) return false;
  if (e.shiftKey !== wantShift) return false;
  if (e.altKey !== wantAlt) return false;

  return e.key.toLowerCase() === key;
}
