#!/usr/bin/env node
// file: scripts/generate-tokens.mjs
//
// Compiles solar-car-interior-theme.json into src/styles/tokens.generated.css.
// This file is the single source of truth for color/radius/shadow/type tokens.
// NEVER hand-edit tokens.generated.css — edit the JSON and re-run this script.
//
// Usage: node scripts/generate-tokens.mjs
// Wire into package.json as a "prebuild" script so it always runs before Vite.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const THEME_PATH = path.join(ROOT, "src/assets/solar-car-interior-theme.json");
const OUT_PATH = path.join(ROOT, 'src/styles/tokens.generated.css');

const theme = JSON.parse(readFileSync(THEME_PATH, 'utf-8'));

// --- helpers ---------------------------------------------------------------

const kebab = (str) => str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Resolve a "{paletteName.step}" reference against theme.palette. */
function resolveRef(ref) {
  const inner = ref.slice(1, -1); // strip { }
  const [paletteName, step] = inner.split('.');
  const entry = theme.palette[paletteName];
  if (!entry) throw new Error(`Unknown palette reference: ${ref}`);
  const value = step === 'base' ? entry.base : entry.scale[step];
  if (!value) throw new Error(`Unknown scale step in reference: ${ref}`);
  return value;
}

function resolveValue(val) {
  return typeof val === 'string' && val.startsWith('{') ? resolveRef(val) : val;
}

/** Emit `  --prefix-key: value;` lines for every string leaf in obj. */
function flattenToDeclarations(obj, prefix = '') {
  const lines = [];
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'note') continue; // skip documentation-only fields
    const varName = `${prefix}${kebab(key)}`;
    if (typeof val === 'string') {
      lines.push(`  --${varName}: ${resolveValue(val)};`);
    } else if (val && typeof val === 'object') {
      lines.push(...flattenToDeclarations(val, `${varName}-`));
    }
  }
  return lines;
}

// --- build sections ----------------------------------------------------------

const bannerComment = `/* ------------------------------------------------------------------------ */
/* AUTO-GENERATED — DO NOT EDIT DIRECTLY                                     */
/* Source: solar-car-interior-theme.json (v${theme.version})                */
/* Regenerate with: node scripts/generate-tokens.mjs                        */
/* ------------------------------------------------------------------------ */
`;

// 1. Raw palette scales (--saddle-tan-500, --rust-terracotta-600, etc.)
const paletteLines = [];
for (const [name, entry] of Object.entries(theme.palette)) {
  const prefix = kebab(name);
  paletteLines.push(`  --${prefix}-base: ${entry.base};`);
  for (const [step, value] of Object.entries(entry.scale)) {
    paletteLines.push(`  --${prefix}-${step}: ${value};`);
  }
}

// 2. Typography, radii, shadow (theme-wide constants, not light/dark dependent)
const typographyLines = flattenToDeclarations(
  { font: theme.typography.fontFamily },
  ''
);
const radiiLines = Object.entries(theme.radii)
  .filter(([k]) => k !== 'note')
  .map(([k, v]) => `  --radius-${kebab(k)}: ${v};`);
const shadowLines = Object.entries(theme.shadow).map(
  ([k, v]) => `  --shadow-${kebab(k)}: ${v};`
);

// 3. Semantic tokens, light/dark (resolved against palette refs)
const lightSemanticLines = flattenToDeclarations(theme.semanticTokens.light, '');
const darkSemanticLines = flattenToDeclarations(theme.semanticTokens.dark, '');
const feedbackLines = flattenToDeclarations(
  { feedback: theme.semanticTokens.feedback },
  ''
);

// --- assemble file -----------------------------------------------------------

const css = `${bannerComment}
:root {
  /* ---- Raw palette scales (rarely used directly — prefer semantic tokens) ---- */
${paletteLines.join('\n')}

  /* ---- Typography ---- */
${typographyLines.join('\n')}

  /* ---- Radii ---- */
${radiiLines.join('\n')}
  --radius-full: 9999px;

  /* ---- Shadow ---- */
${shadowLines.join('\n')}

  /* ---- Feedback (theme-invariant) ---- */
${feedbackLines.join('\n')}

  /* ---- Default (light) semantic tokens ---- */
${lightSemanticLines.join('\n')}
}

[data-theme="dark"] {
  /* ---- Dark semantic token overrides ---- */
${darkSemanticLines.join('\n')}
}

@media (prefers-color-scheme: dark) {
  [data-theme="system"] {
${darkSemanticLines.join('\n')}
  }
}
`;

mkdirSync(path.dirname(OUT_PATH), { recursive: true });
writeFileSync(OUT_PATH, css, 'utf-8');
console.log(`✓ Generated ${path.relative(ROOT, OUT_PATH)} (${css.split('\n').length} lines)`);
