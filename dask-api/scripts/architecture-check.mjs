import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');

const importRegex = /(?:import\s+[^'"]*from\s*|import\s*\(\s*|require\s*\()\s*['"]([^'"]+)['"]/g;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    if (entry.isFile() && full.endsWith('.ts') && !full.endsWith('.d.ts')) {
      files.push(full);
    }
  }

  return files;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function layerFromRelativeFile(relFile) {
  if (relFile === 'app.ts') return 'app';
  if (relFile === 'index.ts' || relFile === 'workers.ts') return 'entry';
  if (relFile.startsWith('core/')) return 'core';
  if (relFile.startsWith('infra/')) return 'infra';
  if (relFile.startsWith('modules/')) return 'modules';
  if (relFile.startsWith('bootstrap/')) return 'bootstrap';
  if (relFile.startsWith('test/')) return 'test';
  return 'other';
}

function layerFromImport(specifier) {
  if (!specifier.startsWith('@/')) return null;
  const rel = specifier.slice(2);
  return layerFromRelativeFile(rel);
}

const forbiddenByLayer = {
  core: new Set(['infra', 'modules', 'bootstrap', 'app', 'entry']),
  infra: new Set(['bootstrap', 'app', 'entry']),
  modules: new Set(['bootstrap', 'app', 'entry']),
  bootstrap: new Set(['app', 'entry']),
  test: new Set([])
};

function collectImports(content) {
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    imports.push(match[1]);
  }
  return imports;
}

function main() {
  if (!fs.existsSync(srcRoot)) {
    console.error('[architecture-check] src/ directory not found.');
    process.exit(1);
  }

  const files = walk(srcRoot);
  const violations = [];

  for (const absFile of files) {
    const relFile = toPosix(path.relative(srcRoot, absFile));
    const sourceLayer = layerFromRelativeFile(relFile);
    const forbidden = forbiddenByLayer[sourceLayer];
    if (!forbidden || forbidden.size === 0) continue;

    const content = fs.readFileSync(absFile, 'utf8');
    const imports = collectImports(content);

    for (const specifier of imports) {
      const targetLayer = layerFromImport(specifier);
      if (!targetLayer) continue;
      if (forbidden.has(targetLayer)) {
        violations.push({
          file: relFile,
          import: specifier,
          sourceLayer,
          targetLayer
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error('[architecture-check] violations found:');
    for (const v of violations) {
      console.error(`- ${v.file}: "${v.import}" (${v.sourceLayer} -> ${v.targetLayer})`);
    }
    process.exit(1);
  }

  console.log('[architecture-check] OK - no architecture layer violations found.');
}

main();
