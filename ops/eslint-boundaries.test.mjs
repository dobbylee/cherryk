import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Linter } from "eslint";
import { moduleBoundariesRule } from "./eslint-boundaries.mjs";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const linter = new Linter();
const configuration = {
  languageOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: {
    cherryk: { rules: { "module-boundaries": moduleBoundariesRule } },
  },
  rules: { "cherryk/module-boundaries": "error" },
};

function messages(relativeFile, source) {
  return linter.verify(source, configuration, {
    filename: path.join(projectRoot, relativeFile),
  });
}

test("same-route and shared imports are allowed", () => {
  assert.deepEqual(
    messages(
      "src/app/quizzes/page.js",
      '"use client"; import "./_components/quiz-card"; import "@/app/_components/icons";',
    ),
    [],
  );
});

test("other route internals are rejected through aliases and relative paths", () => {
  for (const specifier of [
    "@/app/correction/_components/editor",
    "../correction/_components/editor",
  ]) {
    assert.equal(
      messages("src/app/quizzes/page.js", `import "${specifier}";`)[0]
        ?.messageId,
      "route",
    );
  }
});

test("client import of server API is rejected through aliases and relative paths", () => {
  for (const specifier of [
    "@/lib/api/adminAccess",
    "../../lib/api/adminAccess",
  ]) {
    assert.equal(
      messages(
        "src/app/quizzes/page.js",
        `"use client"; import "${specifier}";`,
      )[0]?.messageId,
      "serverApi",
    );
  }
});

test("contracts cannot import UI or API implementation", () => {
  assert.equal(
    messages("src/lib/contracts/quiz.js", 'import "../api/quizzes";')[0]
      ?.messageId,
    "contract",
  );
  assert.equal(
    messages(
      "src/lib/contracts/quiz.js",
      'export * from "@/app/quizzes/page";',
    )[0]?.messageId,
    "route",
  );
});

test("dynamic imports are checked", () => {
  assert.equal(
    messages(
      "src/app/quizzes/page.js",
      'import("../correction/_lib/state");',
    )[0]?.messageId,
    "route",
  );
});
