import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULTS,
  MONTH_LAYOUTS,
  PREF_KEYS,
  THEMES,
  THEME_BOOT_SCRIPT,
  WALL_ORDERS,
  parseChoice,
} from "../lib/prefs.ts";

describe("parseChoice", () => {
  it("keeps a stored value that is one of the choices", () => {
    assert.equal(parseChoice("day", THEMES, "auto"), "day");
    assert.equal(parseChoice("grid", MONTH_LAYOUTS, "wall"), "grid");
    assert.equal(parseChoice("desc", WALL_ORDERS, "asc"), "desc");
  });

  it("falls back on anything else: nothing stored, an old or edited value", () => {
    assert.equal(parseChoice(null, THEMES, "auto"), "auto");
    assert.equal(parseChoice(undefined, THEMES, "auto"), "auto");
    assert.equal(parseChoice("dark", THEMES, "auto"), "auto");
    assert.equal(parseChoice("", MONTH_LAYOUTS, "wall"), "wall");
  });
});

describe("defaults", () => {
  it("open the month as the wall, running from the 1st, in the device's theme", () => {
    assert.deepEqual(DEFAULTS, { theme: "auto", monthLayout: "wall", wallOrder: "asc" });
  });
});

describe("THEME_BOOT_SCRIPT", () => {
  // The script is inlined in <head>; run it against a fake page to check it
  // forces only night or day, and survives storage that throws.
  const run = (stored: string | null, throws = false) => {
    const attrs: Record<string, string> = {};
    const localStorage = {
      getItem: (k: string) => {
        if (throws) throw new Error("denied");
        return k === PREF_KEYS.theme ? stored : null;
      },
    };
    const document = { documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) } };
    new Function("localStorage", "document", THEME_BOOT_SCRIPT)(localStorage, document);
    return attrs["data-theme"];
  };

  it("sets data-theme for a forced theme", () => {
    assert.equal(run("day"), "day");
    assert.equal(run("night"), "night");
  });

  it("leaves auto, garbage and a locked storage to the device", () => {
    assert.equal(run("auto"), undefined);
    assert.equal(run("<script>"), undefined);
    assert.equal(run(null), undefined);
    assert.equal(run("day", true), undefined);
  });
});
