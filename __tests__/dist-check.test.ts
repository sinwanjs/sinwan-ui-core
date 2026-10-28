import { describe, expect, test } from "bun:test";
import {
  checkLibraryDist,
  isRelativeSpecifier,
  isSinwanSpecifier,
  moduleGraph,
  packageName,
  scanSpecifiers,
  sourceUsesSinwan,
  type LibraryDistInput,
} from "../scripts/dist-check";

const CLEAN_FILES = new Map<string, string>([
  ["index.js", 'export * from "./overlay.js";\nexport * from "./dismiss.js";\n'],
  ["overlay.js", 'import { Presence } from "./chunks/chunk-a1.js";\nexport { Presence };\n'],
  ["chunks/chunk-a1.js", 'import { jsx } from "sinwan/jsx-runtime";\nimport { autoUpdate } from "@floating-ui/dom";\nexport const Presence = () => jsx("div", { autoUpdate });\n'],
  ["dismiss.js", "export const isDismissExemptPointerTarget = () => false;\n"],
]);

function input(overrides: Partial<LibraryDistInput> = {}): LibraryDistInput {
  return {
    files: CLEAN_FILES,
    entries: ["index.js", "overlay.js", "dismiss.js"],
    sinwanEntries: ["index.js", "overlay.js"],
    allowedPackages: ["sinwan", "@floating-ui/dom"],
    ...overrides,
  };
}

describe("specifier helpers", () => {
  test("classifies specifiers", () => {
    expect(isRelativeSpecifier("./a.js")).toBe(true);
    expect(isRelativeSpecifier("../a.js")).toBe(true);
    expect(isRelativeSpecifier("sinwan")).toBe(false);
    expect(packageName("sinwan/reactivity")).toBe("sinwan");
    expect(packageName("@floating-ui/dom/dist/x")).toBe("@floating-ui/dom");
    expect(packageName("")).toBe("");
    expect(isSinwanSpecifier("sinwan/reactivity")).toBe(true);
    expect(isSinwanSpecifier("sinwan-ui-core")).toBe(false);
  });

  test("scans static, re-export and dynamic imports", () => {
    expect(scanSpecifiers('import "./a.js"; export * from "./b.js"; import("./c.js");')).toEqual([
      "./a.js",
      "./b.js",
      "./c.js",
    ]);
  });

  test("detects Sinwan use in sources, including JSX", () => {
    expect(sourceUsesSinwan("export const A = () => <div />;")).toBe(true);
    expect(sourceUsesSinwan('import { signal } from "sinwan/reactivity"; export const s = signal(0);')).toBe(true);
    expect(sourceUsesSinwan("export const isExempt = () => false;")).toBe(false);
  });

  test("walks relative imports once, tolerating cycles and missing files", () => {
    const files = new Map([
      ["a.js", 'import "./b.js"; import "./missing.js"; import "sinwan";'],
      ["b.js", 'import "./a.js"; import "./nested/c.js";'],
      ["nested/c.js", 'import "../a.js";'],
    ]);
    expect(moduleGraph(files, "a.js")).toEqual(["a.js", "b.js", "nested/c.js"]);
  });
});

describe("checkLibraryDist", () => {
  test("accepts a split dist with bare Sinwan and package imports", () => {
    expect(checkLibraryDist(input())).toEqual([]);
  });

  test("flags an inlined Sinwan runtime", () => {
    const files = new Map(CLEAN_FILES);
    files.set(
      "chunks/chunk-a1.js",
      "// ../../sinwan/dist/esm/_chunks/core-x.js\nconst pendingEffects = [];\nexport const Presence = () => pendingEffects;\n",
    );
    expect(checkLibraryDist(input({ files }))).toEqual([
      'chunks/chunk-a1.js: contains "pendingEffects" (inlined runtime or package)',
      'chunks/chunk-a1.js: contains "/_chunks/" (inlined runtime or package)',
      'chunks/chunk-a1.js: contains "sinwan/dist/" (inlined runtime or package)',
      "index.js: uses Sinwan but its graph has no bare sinwan/* import",
      "overlay.js: uses Sinwan but its graph has no bare sinwan/* import",
    ]);
  });

  test("flags inlined packages, undeclared packages and broken relative imports", () => {
    const files = new Map(CLEAN_FILES);
    files.set("dismiss.js", '// node_modules/clsx/dist/clsx.mjs\nimport "tailwind-merge";\nimport "./gone.js";\n');
    expect(checkLibraryDist(input({ files }))).toEqual([
      'dismiss.js: contains "node_modules/" (inlined runtime or package)',
      'dismiss.js: imports undeclared package "tailwind-merge"',
      'dismiss.js: imports missing file "./gone.js"',
    ]);
  });

  test("flags the development JSX runtime", () => {
    const files = new Map(CLEAN_FILES);
    files.set(
      "chunks/chunk-a1.js",
      'import { jsxDEV } from "sinwan/jsx-dev-runtime";\nexport const Presence = () => jsxDEV("div", {}, undefined, false, undefined, this);\n',
    );
    expect(checkLibraryDist(input({ files }))).toEqual([
      'chunks/chunk-a1.js: imports the development JSX runtime "sinwan/jsx-dev-runtime"',
    ]);
  });

  test("reports missing entries and Sinwan entries that were never emitted", () => {
    expect(checkLibraryDist(input({ entries: ["theme.js"], sinwanEntries: ["theme.js"] }))).toEqual([
      "missing entry theme.js",
      "theme.js: uses Sinwan but its graph has no bare sinwan/* import",
    ]);
  });
});
