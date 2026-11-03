#!/usr/bin/env node
/**
 * Checks every visual theme:
 *   - registry.ts, themes/index.css and themes/<id>.css agree,
 *   - each CSS file has the blocks its schemes need,
 *   - every custom property it sets is a token defined in styles.css,
 *   - literal colors meet WCAG AA (4.5:1) for text on its surface.
 * Run: yarn check:themes
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src");
const read = (file) => readFileSync(join(root, file), "utf8");
const errors = [];
const fail = (message) => errors.push(message);

// --- registry ---------------------------------------------------------
const registry = read("themes/registry.ts");
const list = registry.slice(
  registry.indexOf("export const THEMES"),
  registry.indexOf("] as const"),
);
const themes = [...list.matchAll(/\{([^{}]*)\}/g)].map(([, body]) => ({
  id: body.match(/id:\s*"([^"]+)"/)?.[1],
  schemes: body.match(/schemes:\s*\[([^\]]*)\]/)?.[1].match(/light|dark/g) ?? [
    "light",
    "dark",
  ],
}));
const imports = [
  ...read("themes/index.css").matchAll(/@import\s+"\.\/([^"]+)\.css"/g),
].map((match) => match[1]);

// --- known tokens -----------------------------------------------------
const styles = read("styles.css");
const known = new Set(
  [...styles.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]),
);
const knownPrefixes = ["--text-", "--radius-", "--color-tint-", "--ik-accent"];
const isKnown = (token) =>
  known.has(token) || knownPrefixes.some((prefix) => token.startsWith(prefix));

// --- color helpers ----------------------------------------------------
const toRgb = (hex) => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
};
const luminance = (hex) => {
  const [r, g, b] = toRgb(hex).map((c) =>
    c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** Declarations of every block whose selector matches `test`. */
function declarations(css, test) {
  const found = {};
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!test(selector.trim())) continue;
    for (const [, name, value] of body.matchAll(
      /(--[a-z0-9-]+)\s*:\s*([^;]+);/g,
    )) {
      found[name] = value.trim();
    }
  }
  return found;
}

function resolve(value, vars, depth = 0) {
  const ref = value?.match(/^var\((--[a-z0-9-]+)\)$/);
  if (ref && depth < 8) return resolve(vars[ref[1]], vars, depth + 1);
  return /^#[0-9a-f]{3,6}$/i.test(value ?? "") ? value : null;
}

const PAIRS = [
  ["--ik-fg", "--ik-paper"],
  ["--ik-fg", "--ik-canvas"],
  ["--ik-fg-muted", "--ik-paper"],
  ["--ik-link", "--ik-paper"],
  ...["primary", "secondary", "info", "success", "warning", "error"].map(
    (name) => [`--ik-${name}-contrast`, `--ik-${name}`],
  ),
  ["--ik-action-fg", "--ik-action-bg"],
];

for (const theme of themes) {
  const { id, schemes } = theme;
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
    fail(`registry: invalid theme id ${JSON.stringify(id)}`);
    continue;
  }
  if (id === "default") continue;
  if (!imports.includes(id)) fail(`${id}: not imported in themes/index.css`);
  if (!existsSync(join(root, `themes/${id}.css`))) {
    fail(`${id}: themes/${id}.css is missing`);
    continue;
  }
  const css = read(`themes/${id}.css`).replace(/\/\*[\s\S]*?\*\//g, "");
  const mine = `:root[data-ik-theme="${id}"]`;
  const shared = declarations(css, (sel) => sel === mine);

  for (const scheme of schemes) {
    const selector =
      scheme === "dark"
        ? `${mine}[data-color-scheme="dark"]`
        : `${mine}:not([data-color-scheme="dark"])`;
    const own = declarations(css, (sel) => sel === selector);
    if (Object.keys(own).length === 0) {
      fail(`${id}: no ${scheme} block (${selector})`);
      continue;
    }
    const vars = { ...shared, ...own };
    for (const [a, b] of PAIRS) {
      const fg = resolve(vars[a], vars);
      const bg = resolve(vars[b], vars);
      if (!fg || !bg) continue; // not a literal color (e.g. color-mix): skipped
      const ratio = contrast(fg, bg);
      if (ratio < 4.5) {
        fail(
          `${id} (${scheme}): ${a} on ${b} is ${ratio.toFixed(2)}:1 (< 4.5)`,
        );
      }
    }
  }
  for (const token of Object.keys({ ...declarations(css, () => true) })) {
    if (!isKnown(token)) fail(`${id}: unknown token ${token} (typo?)`);
  }
}
for (const name of imports) {
  if (!themes.some((theme) => theme.id === name)) {
    fail(
      `themes/index.css imports ${name}.css but registry.ts has no such theme`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.map((line) => `✗ ${line}`).join("\n"));
  process.exit(1);
}
console.log(`✓ ${themes.length} themes OK`);
