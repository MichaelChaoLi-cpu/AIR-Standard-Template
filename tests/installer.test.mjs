import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(repoRoot, "bin", "nayoshi.mjs");
const expectedSkills = [
  "initialize-project",
  "inspect-repo",
  "manage-data-version",
  "manage-git-version",
];

function run(...args) {
  return spawnSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function makeTempRoot() {
  return mkdtempSync(join(tmpdir(), "nayoshi-installer-test-"));
}

function skillNames(root, agent) {
  return readdirSync(join(root, agent, "skills")).sort();
}

test("reports version and GitHub npx installation commands", () => {
  const version = run("--version");
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), "0.0.1");

  const help = run("--help");
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /AIR-Standard-Template#version\/latest --target \./);
  assert.match(help.stdout, /AIR-Standard-Template#version\/0\.0\.1 --target \./);
});

test("keeps package and release metadata aligned", () => {
  const manifest = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  assert.equal(manifest.name, "nayoshi");
  assert.equal(manifest.version, "0.0.1");
  assert.equal(manifest.nayoshi.latestRef, "version/latest");
  assert.equal(manifest.bin.nayoshi, "./bin/nayoshi.mjs");
});

test("installs both agent skill sets and preserves unrelated skills", () => {
  const root = makeTempRoot();
  try {
    for (const agent of [".codex", ".claude"]) {
      const other = join(root, agent, "skills", "team-private-skill");
      mkdirSync(other, { recursive: true });
      writeFileSync(join(other, "SKILL.md"), "keep\n", "utf8");
    }

    const result = run("--target", root);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim().split("\n").at(-2), "Installed version: 0.0.1");
    assert.equal(result.stdout.trim().split("\n").at(-1), "生在744番地。");

    for (const agent of [".codex", ".claude"]) {
      assert.deepEqual(skillNames(root, agent), [...expectedSkills, "team-private-skill"].sort());
      assert.equal(
        readFileSync(join(root, agent, "skills", "team-private-skill", "SKILL.md"), "utf8"),
        "keep\n",
      );
      for (const name of expectedSkills) {
        assert.equal(existsSync(join(root, agent, "skills", name, "SKILL.md")), true);
      }
    }

    const installManifest = JSON.parse(
      readFileSync(join(root, ".codex", "nayoshi-install.json"), "utf8"),
    );
    assert.equal(installManifest.schema, "nayoshi-install/1");
    assert.equal(installManifest.package, "nayoshi");
    assert.equal(installManifest.version, "0.0.1");
    assert.equal(installManifest.releaseBranch, "version/0.0.1");
    assert.equal(installManifest.latestBranch, "version/latest");
    assert.deepEqual(installManifest.skills, expectedSkills);
    assert.deepEqual(installManifest.targets, ["codex", "claude"]);
    assert.equal(installManifest.message, "生在744番地。");

    const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
    assert.match(gitignore, /^\.codex\/skills\/$/m);
    assert.match(gitignore, /^\.claude\/skills\/$/m);
    for (const path of ["docs", "data", "rsc", "etc"]) {
      assert.equal(existsSync(join(root, path)), false);
    }
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("requires force only for Nayoshi conflicts", () => {
  const root = makeTempRoot();
  try {
    const firstInstall = run("--target", root);
    assert.equal(firstInstall.status, 0, firstInstall.stderr);
    const managedSkill = join(root, ".codex", "skills", "initialize-project", "SKILL.md");
    const otherSkill = join(root, ".codex", "skills", "another-skill");
    writeFileSync(managedSkill, "local change\n", "utf8");
    mkdirSync(otherSkill);
    writeFileSync(join(otherSkill, "SKILL.md"), "preserve\n", "utf8");

    const blocked = run("--target", root);
    assert.equal(blocked.status, 1);
    assert.match(blocked.stderr, /already exist/);
    assert.equal(readFileSync(managedSkill, "utf8"), "local change\n");

    const forced = run("--target", root, "--force");
    assert.equal(forced.status, 0, forced.stderr);
    assert.notEqual(readFileSync(managedSkill, "utf8"), "local change\n");
    assert.equal(readFileSync(join(otherSkill, "SKILL.md"), "utf8"), "preserve\n");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("merges .gitignore without replacing content and is idempotent", () => {
  const root = makeTempRoot();
  try {
    const gitignorePath = join(root, ".gitignore");
    writeFileSync(gitignorePath, "node_modules/\n", "utf8");
    const firstInstall = run("--target", root);
    assert.equal(firstInstall.status, 0, firstInstall.stderr);
    const first = readFileSync(gitignorePath, "utf8");
    assert.match(first, /^node_modules\/$/m);
    assert.equal(first.match(/^\.codex\/skills\/$/gm)?.length, 1);
    assert.equal(first.match(/^\.claude\/skills\/$/gm)?.length, 1);

    const secondInstall = run("--target", root, "--force");
    assert.equal(secondInstall.status, 0, secondInstall.stderr);
    assert.equal(readFileSync(gitignorePath, "utf8"), first);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("rejects unsafe .gitignore before installing", () => {
  const root = makeTempRoot();
  try {
    mkdirSync(join(root, ".gitignore"));
    const result = run("--target", root);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsafe \.gitignore/);
    assert.equal(existsSync(join(root, ".codex")), false);
    assert.equal(existsSync(join(root, ".claude")), false);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("rejects unsafe installer manifests without replacing skills", () => {
  const root = makeTempRoot();
  try {
    assert.equal(run("--target", root).status, 0);
    const managedSkill = join(root, ".codex", "skills", "inspect-repo", "SKILL.md");
    writeFileSync(managedSkill, "local change\n", "utf8");
    const manifest = join(root, ".codex", "nayoshi-install.json");
    rmSync(manifest);
    mkdirSync(manifest);

    const result = run("--target", root, "--force");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /unsafe installer manifest/);
    assert.equal(readFileSync(managedSkill, "utf8"), "local change\n");
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("rejects source version mismatches and nested targets", () => {
  const root = makeTempRoot();
  const source = join(root, "source");
  const target = join(root, "target");
  try {
    mkdirSync(source);
    mkdirSync(target);
    writeFileSync(
      join(source, "package.json"),
      '{"name":"nayoshi","version":"9.9.9"}\n',
      "utf8",
    );
    const mismatch = run("--source", source, "--target", target);
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /installer version 0\.0\.1.*selected source version 9\.9\.9/);

    const nested = join(repoRoot, ".nested-installer-target");
    mkdirSync(nested, { recursive: true });
    try {
      const nestedResult = run("--target", nested);
      assert.equal(nestedResult.status, 1);
      assert.match(nestedResult.stderr, /distinct and non-nested/);
    } finally {
      rmSync(nested, { force: true, recursive: true });
    }
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("ships English, Chinese, and Japanese documentation", () => {
  const localizedMessages = {
    "README.md": "Born at No. 744.",
    "README-ZH.md": "生在744番地。",
    "README-JP.md": "744番地に生まれた。",
  };
  for (const [name, message] of Object.entries(localizedMessages)) {
    const content = readFileSync(join(repoRoot, name), "utf8");
    assert.match(content, /Nayoshi/);
    assert.match(content, /0\.0\.1/);
    assert.equal(content.includes(message), true);
  }
});
