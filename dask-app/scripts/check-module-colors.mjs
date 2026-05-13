import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TARGET_DIRS = ["src/modules"];
const TARGET_EXTENSIONS = new Set([".css", ".tsx"]);
const IGNORED_FILE_PATTERNS = [/\.test\.[cm]?[tj]sx?$/];
const ALLOW_COMMENT = "color-guardrail-allow:";

const FORBIDDEN_PATTERNS = [
  {
    name: "hex color",
    regex: /#[0-9a-fA-F]{3,8}\b/g
  },
  {
    name: "rgb/rgba color",
    regex: /\brgba?\(\s*[-+]?(?:\d|\.)/gi
  },
  {
    name: "hsl/hsla color",
    regex: /\bhsla?\(\s*[-+]?(?:\d|\.)/gi
  }
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function isIgnored(filePath) {
  const relativePath = toPosix(path.relative(ROOT, filePath));
  return IGNORED_FILE_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function listTargetFiles(dir) {
  const absoluteDir = path.join(ROOT, dir);
  const entries = readdirSync(absoluteDir);
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(absoluteDir, entry);
    const stats = statSync(filePath);

    if (stats.isDirectory()) {
      files.push(...listTargetFiles(path.relative(ROOT, filePath)));
      continue;
    }

    if (TARGET_EXTENSIONS.has(path.extname(filePath)) && !isIgnored(filePath)) {
      files.push(filePath);
    }
  }

  return files;
}

function hasAllowComment(lines, lineIndex) {
  const line = lines[lineIndex] ?? "";
  const previousLine = lines[lineIndex - 1] ?? "";
  return line.includes(ALLOW_COMMENT) || previousLine.includes(ALLOW_COMMENT);
}

function stripSafeContent(line) {
  return line.replace(/var\(\s*--workspace-[^)]+\)/g, "");
}

function findViolations(filePath) {
  const relativePath = toPosix(path.relative(ROOT, filePath));
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const violations = [];

  lines.forEach((rawLine, lineIndex) => {
    if (hasAllowComment(lines, lineIndex)) {
      return;
    }

    const line = stripSafeContent(rawLine);

    for (const pattern of FORBIDDEN_PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match;

      while ((match = pattern.regex.exec(line)) !== null) {
        const value = match[0];

        if (value.startsWith("&#")) {
          continue;
        }

        violations.push({
          file: relativePath,
          line: lineIndex + 1,
          type: pattern.name,
          value: value.trim(),
          source: rawLine.trim()
        });
      }
    }
  });

  return violations;
}

const files = TARGET_DIRS.flatMap(listTargetFiles);
const violations = files.flatMap(findViolations);

if (violations.length > 0) {
  console.error("Hardcoded colors found in visual module CSS/TSX files.\n");
  console.error("Use workspace tokens such as var(--workspace-text-primary), var(--workspace-border), or var(--workspace-surface).");
  console.error(`For legitimate exceptions, add an inline ${ALLOW_COMMENT} comment with the reason.\n`);

  for (const violation of violations) {
    console.error(`${violation.file}:${violation.line} ${violation.type} ${violation.value}`);
    console.error(`  ${violation.source}`);
  }

  process.exit(1);
}

console.log(`Module color guardrail passed (${files.length} files scanned).`);
