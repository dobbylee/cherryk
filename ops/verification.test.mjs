import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const { scripts } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);
const buildOrigin = "http://127.0.0.1:8080";
const inheritedOrigin = "https://inherited.example.test";

// Execute the real package commands with isolated stand-ins; never start Docker,
// Gradle, a build, or a deployment from these gate regression tests.
function runScript(script, failure = "", origin = inheritedOrigin) {
  const fixture = mkdtempSync(join(tmpdir(), "cherryk-verification-"));
  try {
    mkdirSync(join(fixture, "bin"));
    mkdirSync(join(fixture, "backend"));
    const log = join(fixture, "calls.jsonl");
    for (const command of ["pnpm", "docker", "gradlew"]) {
      const executable = join(
        fixture,
        command === "gradlew" ? "backend" : "bin",
        command,
      );
      writeFileSync(
        executable,
        `#!${process.execPath}
const fs = require("node:fs");
const args = process.argv.slice(2);
const stage = ${JSON.stringify(command)} === "pnpm" ? args[0] : ${JSON.stringify(command)};
fs.appendFileSync(process.env.VERIFICATION_LOG, JSON.stringify({
  stage, args, origin: process.env.SPRING_BACKEND_ORIGIN ?? null,
}) + "\\n");
process.exit(stage === process.env.VERIFICATION_FAILURE ? 17 : 0);
`,
        { mode: 0o755 },
      );
    }
    const env = {
      ...process.env,
      PATH: `${join(fixture, "bin")}:${process.env.PATH}`,
      VERIFICATION_LOG: log,
      VERIFICATION_FAILURE: failure,
    };
    if (origin === null) delete env.SPRING_BACKEND_ORIGIN;
    else env.SPRING_BACKEND_ORIGIN = origin;
    const result = spawnSync("/bin/sh", ["-c", scripts[script]], {
      cwd: fixture,
      env,
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.ifError(result.error);
    const calls = readFileSync(log, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    return { status: result.status, calls };
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

const stages = ["test", "build", "build:backend", "compose:check"];
for (const origin of [null, inheritedOrigin]) {
  test(`verify isolates the build origin with inherited origin ${origin}`, () => {
    const result = runScript("verify", "", origin);
    assert.equal(result.status, 0);
    assert.deepEqual(
      result.calls.map((call) => call.stage),
      stages,
    );
    assert.deepEqual(
      result.calls.map((call) => call.origin),
      [origin, buildOrigin, origin, origin],
    );
  });
}

for (const [index, stage] of stages.entries()) {
  test(`verify propagates ${stage} failure and stops remaining gates`, () => {
    const result = runScript("verify", stage);
    assert.equal(result.status, 17);
    assert.deepEqual(
      result.calls.map((call) => call.stage),
      stages.slice(0, index + 1),
    );
  });
}

test("backend gate checks Docker before forcing actual Gradle test execution", () => {
  const result = runScript("test:backend");
  assert.equal(result.status, 0);
  assert.deepEqual(
    result.calls.map(({ stage, args }) => ({ stage, args })),
    [
      { stage: "docker", args: ["info"] },
      { stage: "gradlew", args: ["-p", "backend", "test", "--rerun-tasks"] },
    ],
  );
});

test("backend gate fails without starting Gradle when Docker is unavailable", () => {
  const result = runScript("test:backend", "docker");
  assert.equal(result.status, 17);
  assert.deepEqual(
    result.calls.map((call) => call.stage),
    ["docker"],
  );
});

test("backend gate propagates Gradle failure", () => {
  assert.equal(runScript("test:backend", "gradlew").status, 17);
});
