// Gilded Heist — entrypoint: hand the game in.
// Copies game/ and screenshots/ from this repository into the output directory
// and writes the dossier there with buildDossier from vendor/makefun-game.ts.
// The output directory is MAKEFUN_OUTPUT_DIR, falling back to /output.
// The entry directory is located from import.meta.url, never from the cwd.

import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const entryDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(entryDir, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(entryDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
console.log(`wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)`);
