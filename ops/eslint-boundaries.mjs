import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceRoot = path.join(projectRoot, "src");
const appRoot = path.join(sourceRoot, "app");
const contractRoot = path.join(sourceRoot, "lib", "contracts");
const apiRoot = path.join(sourceRoot, "lib", "api");

function isInside(file, directory) {
  return file === directory || file.startsWith(`${directory}${path.sep}`);
}

function resolveProjectImport(importer, specifier) {
  if (specifier.startsWith("@/")) {
    return path.resolve(sourceRoot, specifier.slice(2));
  }
  if (specifier.startsWith(".")) {
    return path.resolve(path.dirname(importer), specifier);
  }
  return null;
}

function routeOwner(file) {
  if (!isInside(file, appRoot)) return null;
  const segments = path.relative(appRoot, file).split(path.sep);
  if (segments.length < 2 || segments[0].startsWith("_")) return null;
  if (segments[0] === "admin" && segments.length > 2) {
    return `${segments[0]}/${segments[1]}`;
  }
  return segments[0];
}

function isServerApi(file) {
  return (
    isInside(file, path.join(apiRoot, "server")) ||
    file === path.join(apiRoot, "adminAccess") ||
    file === path.join(apiRoot, "adminAccess.ts") ||
    file.endsWith(".server") ||
    file.endsWith(".server.ts") ||
    file.endsWith(".server.tsx")
  );
}

export const moduleBoundariesRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Keep route, server API, and contract imports within their owners.",
    },
    schema: [],
    messages: {
      route:
        "Import shared UI or this route's own files instead of another route's internals.",
      serverApi: "Client modules cannot import server-only API helpers.",
      contract: "Contracts cannot import UI or API implementation.",
    },
  },
  create(context) {
    const importer = path.resolve(context.filename);
    const isTestFile = /\.test\.[cm]?[jt]sx?$/.test(importer);
    const isClient = context.sourceCode.ast.body.some(
      (statement) =>
        statement.type === "ExpressionStatement" &&
        statement.directive === "use client",
    );

    function check(node, source) {
      if (typeof source?.value !== "string") return;
      const target = resolveProjectImport(importer, source.value);
      if (!target || !isInside(target, sourceRoot)) return;

      const targetRoute = routeOwner(target);
      if (!isTestFile && targetRoute && targetRoute !== routeOwner(importer)) {
        context.report({ node, messageId: "route" });
      }
      if (isClient && isServerApi(target)) {
        context.report({ node, messageId: "serverApi" });
      }
      if (
        isInside(importer, contractRoot) &&
        (isInside(target, appRoot) || isInside(target, apiRoot))
      ) {
        context.report({ node, messageId: "contract" });
      }
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source);
      },
      ExportNamedDeclaration(node) {
        check(node, node.source);
      },
      ExportAllDeclaration(node) {
        check(node, node.source);
      },
      ImportExpression(node) {
        check(node, node.source);
      },
    };
  },
};
