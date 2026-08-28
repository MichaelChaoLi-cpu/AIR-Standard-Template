#!/usr/bin/env node

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CLI_VERSION = "0.0.1";
const PACKAGE_NAME = "nayoshi";
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAYOSHI_SKILLS = [
  "initialize-project",
  "inspect-repo",
  "manage-data-version",
  "manage-git-version",
];
const SKILL_TARGETS = [
  { label: "Codex", parts: [".codex", "skills"] },
  { label: "Claude", parts: [".claude", "skills"] },
];
const GITIGNORE_PATTERNS = [".codex/skills/", ".claude/skills/"];

class CliError extends Error {}

function printHelp() {
  console.log(`Nayoshi ${CLI_VERSION} skill installer

Usage:
  nayoshi --target <directory> [--force]
  nayoshi --source <checkout> --target <directory> [--force]
  nayoshi --help
  nayoshi --version

Options:
  --source <checkout>  Existing local Nayoshi checkout; intended for development/tests.
  --target <directory> Existing project root. Defaults to the current directory.
  --force              Replace only existing Nayoshi skills; preserve all other skills.
  --help               Show this help.
  --version            Show the installed Nayoshi package version.

Examples:
  npx --yes nayoshi@latest --target .
  npx --yes nayoshi@${CLI_VERSION} --target .
  nayoshi --source ../Nayoshi --target ./my-project
`);
}

function fail(message) {
  throw new CliError(message);
}

function takeValue(args, index, option) {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    fail(`${option} requires a value.`);
  }
  return value;
}

function parseArgs(argv) {
  if (argv.length === 0 || argv.includes("--help")) {
    printHelp();
    process.exit(0);
  }
  if (argv.length === 1 && argv[0] === "--version") {
    console.log(CLI_VERSION);
    process.exit(0);
  }
  if (!argv[0].startsWith("--")) {
    fail(`unexpected command "${argv[0]}". Run "nayoshi --help".`);
  }

  const options = { force: false, source: "", target: process.cwd() };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--force") {
      options.force = true;
    } else if (arg === "--source") {
      options.source = takeValue(argv, index, "--source");
      index += 1;
    } else if (arg.startsWith("--source=")) {
      options.source = arg.slice("--source=".length);
    } else if (arg === "--target") {
      options.target = takeValue(argv, index, "--target");
      index += 1;
    } else if (arg.startsWith("--target=")) {
      options.target = arg.slice("--target=".length);
    } else {
      fail(`unknown option "${arg}". Run "nayoshi --help".`);
    }
  }
  options.target = resolve(options.target);
  options.source = options.source ? resolve(options.source) : PACKAGE_ROOT;
  return options;
}

function canonicalExistingDirectory(path, label) {
  if (!existsSync(path)) {
    fail(`${label} does not exist: ${path}`);
  }
  if (lstatSync(path).isSymbolicLink()) {
    fail(`${label} must not be a symlink: ${path}`);
  }
  const canonical = realpathSync(path);
  if (!lstatSync(canonical).isDirectory()) {
    fail(`${label} is not a directory: ${canonical}`);
  }
  return canonical;
}

function isWithin(path, parent) {
  const rel = relative(parent, path);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

function assertDistinctRoots(sourceRoot, targetRoot) {
  if (isWithin(sourceRoot, targetRoot) || isWithin(targetRoot, sourceRoot)) {
    fail("source and target roots must be distinct and non-nested");
  }
}

function assertNoSymlinks(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = join(root, entry.name);
    if (entry.isSymbolicLink()) {
      fail(`skill source contains a symlink: ${child}`);
    }
    if (entry.isDirectory()) {
      assertNoSymlinks(child);
    }
  }
}

function readSourceVersion(sourceRoot) {
  const manifestPath = join(sourceRoot, "package.json");
  if (!existsSync(manifestPath) || lstatSync(manifestPath).isSymbolicLink()) {
    fail("selected source lacks a safe package.json release manifest");
  }
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    fail(
      `cannot parse selected source package.json: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  if (
    !manifest ||
    typeof manifest !== "object" ||
    manifest.name !== PACKAGE_NAME ||
    typeof manifest.version !== "string"
  ) {
    fail(`selected source package.json must identify package ${PACKAGE_NAME} with a version`);
  }
  if (manifest.version !== CLI_VERSION) {
    fail(
      `installer version ${CLI_VERSION} does not match selected source version ${manifest.version}`,
    );
  }
  return manifest.version;
}

function discoverSkills(sourceRoot) {
  const sources = [];
  for (const target of SKILL_TARGETS) {
    const skillsRoot = join(sourceRoot, ...target.parts);
    if (!existsSync(skillsRoot) || lstatSync(skillsRoot).isSymbolicLink()) {
      fail(`selected source does not contain a safe ${target.parts.join("/")} directory`);
    }
    for (const name of NAYOSHI_SKILLS) {
      const skillRoot = join(skillsRoot, name);
      if (!existsSync(skillRoot) || !lstatSync(skillRoot).isDirectory()) {
        fail(`selected source lacks ${target.label} skill ${name}`);
      }
      assertNoSymlinks(skillRoot);
      if (!existsSync(join(skillRoot, "SKILL.md"))) {
        fail(`${target.label} skill ${name} lacks SKILL.md`);
      }
    }
    sources.push({ ...target, skillsRoot });
  }
  return sources;
}

function ensureDestination(targetRoot, parts) {
  let current = targetRoot;
  for (const part of parts) {
    current = join(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      fail(`refusing to install through symlink: ${current}`);
    }
    mkdirSync(current, { recursive: true });
  }
  return current;
}

function prepareGitignore(targetRoot) {
  const path = join(targetRoot, ".gitignore");
  if (existsSync(path)) {
    const stat = lstatSync(path);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      fail(`refusing to replace unsafe .gitignore: ${path}`);
    }
  }
  const original = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = new Set(original.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  const coverage = {
    ".codex/skills/": [".codex/skills/", "/.codex/skills/", ".codex/", "/.codex/"],
    ".claude/skills/": [".claude/skills/", "/.claude/skills/", ".claude/", "/.claude/"],
  };
  const missing = GITIGNORE_PATTERNS.filter(
    (pattern) => !coverage[pattern].some((candidate) => lines.has(candidate)),
  );
  if (missing.length === 0) {
    return { changed: false, original, path, rendered: original, status: "unchanged" };
  }
  const separator = original && !original.endsWith("\n") ? "\n" : "";
  const heading = original.trim() ? "\n# Nayoshi local agent skills\n" : "# Nayoshi local agent skills\n";
  return {
    changed: true,
    original,
    path,
    rendered: `${original}${separator}${heading}${missing.join("\n")}\n`,
    status: "updated",
  };
}

function installSkills(sources, targetRoot, force, sourceVersion, gitignore) {
  const destinations = sources.map((source) => ({
    ...source,
    destination: ensureDestination(targetRoot, source.parts),
  }));
  const conflicts = [];
  for (const target of destinations) {
    for (const name of NAYOSHI_SKILLS) {
      const destination = join(target.destination, name);
      if (existsSync(destination)) {
        if (lstatSync(destination).isSymbolicLink()) {
          fail(`refusing to replace symlinked ${target.label} skill: ${name}`);
        }
        conflicts.push({ target, name });
      }
    }
  }
  if (conflicts.length > 0 && !force) {
    fail("Nayoshi skills already exist. Re-run with --force to replace only Nayoshi skills.");
  }

  const manifestPath = join(targetRoot, ".codex", "nayoshi-install.json");
  if (existsSync(manifestPath)) {
    const stat = lstatSync(manifestPath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      fail(`refusing to replace unsafe installer manifest: ${manifestPath}`);
    }
  }

  const transactionRoot = mkdtempSync(join(targetRoot, ".nayoshi-install-"));
  const incomingRoot = join(transactionRoot, "incoming");
  const backupRoot = join(transactionRoot, "backup");
  const incomingManifest = join(transactionRoot, "nayoshi-install.json");
  const manifestBackup = join(backupRoot, "nayoshi-install.json");
  const incomingGitignore = join(transactionRoot, "gitignore");
  const gitignoreBackup = join(backupRoot, "gitignore");
  const installed = [];
  const backedUp = [];
  let manifestInstalled = false;
  let manifestBackedUp = false;
  let gitignoreInstalled = false;
  let gitignoreBackedUp = false;

  try {
    const manifestPayload = {
      schema: "nayoshi-install/1",
      package: PACKAGE_NAME,
      version: sourceVersion,
      skills: [...NAYOSHI_SKILLS],
      targets: SKILL_TARGETS.map((target) => target.label.toLowerCase()),
      message: "生在744番地。",
    };
    writeFileSync(incomingManifest, `${JSON.stringify(manifestPayload, null, 2)}\n`, "utf8");
    if (gitignore.changed) {
      writeFileSync(incomingGitignore, gitignore.rendered, "utf8");
    }

    for (const [targetIndex, target] of destinations.entries()) {
      for (const name of NAYOSHI_SKILLS) {
        const incoming = join(incomingRoot, String(targetIndex), name);
        mkdirSync(dirname(incoming), { recursive: true });
        cpSync(join(target.skillsRoot, name), incoming, {
          errorOnExist: true,
          force: false,
          recursive: true,
        });
        assertNoSymlinks(incoming);
      }
    }

    for (const conflict of conflicts) {
      const targetIndex = destinations.indexOf(conflict.target);
      const backup = join(backupRoot, String(targetIndex), conflict.name);
      mkdirSync(dirname(backup), { recursive: true });
      renameSync(join(conflict.target.destination, conflict.name), backup);
      backedUp.push({ ...conflict, backup });
    }
    for (const [targetIndex, target] of destinations.entries()) {
      for (const name of NAYOSHI_SKILLS) {
        renameSync(join(incomingRoot, String(targetIndex), name), join(target.destination, name));
        installed.push({ target, name });
      }
    }

    if (existsSync(manifestPath)) {
      mkdirSync(dirname(manifestBackup), { recursive: true });
      renameSync(manifestPath, manifestBackup);
      manifestBackedUp = true;
    }
    renameSync(incomingManifest, manifestPath);
    manifestInstalled = true;

    if (gitignore.changed) {
      if (existsSync(gitignore.path)) {
        renameSync(gitignore.path, gitignoreBackup);
        gitignoreBackedUp = true;
      }
      renameSync(incomingGitignore, gitignore.path);
      gitignoreInstalled = true;
    }
  } catch (error) {
    if (gitignoreInstalled) {
      rmSync(gitignore.path, { force: true });
    }
    if (gitignoreBackedUp && existsSync(gitignoreBackup)) {
      renameSync(gitignoreBackup, gitignore.path);
    }
    if (manifestInstalled) {
      rmSync(manifestPath, { force: true });
    }
    if (manifestBackedUp && existsSync(manifestBackup)) {
      renameSync(manifestBackup, manifestPath);
    }
    for (const item of installed.reverse()) {
      rmSync(join(item.target.destination, item.name), { force: true, recursive: true });
    }
    for (const item of backedUp.reverse()) {
      if (existsSync(item.backup)) {
        renameSync(item.backup, join(item.target.destination, item.name));
      }
    }
    throw error;
  } finally {
    rmSync(transactionRoot, { force: true, recursive: true });
  }

  return { manifest: manifestPath, replaced: conflicts.length };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const targetRoot = canonicalExistingDirectory(options.target, "target project");
  const sourceRoot = canonicalExistingDirectory(options.source, "Nayoshi source");
  assertDistinctRoots(sourceRoot, targetRoot);
  const sourceVersion = readSourceVersion(sourceRoot);
  const sources = discoverSkills(sourceRoot);
  const gitignore = prepareGitignore(targetRoot);
  const installation = installSkills(
    sources,
    targetRoot,
    options.force,
    sourceVersion,
    gitignore,
  );

  console.log("Nayoshi Codex and Claude skills installed.");
  console.log(
    `Source:    ${sourceRoot === PACKAGE_ROOT ? `bundled:${sourceVersion}` : `local:${sourceRoot}`}`,
  );
  console.log(`Target:    ${targetRoot}`);
  console.log(`Installed: ${NAYOSHI_SKILLS.length} skill(s) for each agent`);
  console.log(`Replaced:  ${installation.replaced}`);
  console.log(`Manifest:  ${installation.manifest}`);
  console.log(`Git ignore: ${gitignore.status} (${gitignore.path})`);
  console.log(`Installed version: ${sourceVersion}`);
  console.log("生在744番地。");
}

try {
  main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
