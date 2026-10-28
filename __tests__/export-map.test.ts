import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  barrelLine,
  buildExportMap,
  diffBarrel,
  diffExportMap,
  discoverModules,
  distDeclarationFile,
  distModuleFile,
  libraryEntrypoints,
  moduleExport,
  runExportMap,
  type CoreModule,
  type TextSink,
} from "../scripts/export-map";

const ROOT = join(import.meta.dir, "..");

const MODULES: CoreModule[] = [
  { name: "core", entry: "core.tsx" },
  { name: "dismiss", entry: "dismiss.ts" },
];

const PUBLIC_MODULES = [
  "controls",
  "core",
  "direction",
  "dismiss",
  "floating",
  "menu-sub",
  "overlay",
  "slot",
  "theme",
  "types",
];

function collect(): TextSink & { text: () => string } {
  let out = "";
  return {
    write: (text: string) => {
      out += text;
    },
    text: () => out,
  };
}

async function tempPackage(manifest: string, barrel = 'export * from "./core";\nexport * from "./dismiss";\n'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "sinwan-ui-core-export-map-"));
  await Bun.write(join(dir, "src/core.tsx"), "export const Presence = 1;\n");
  await Bun.write(join(dir, "src/dismiss.ts"), "export const dismiss = 1;\n");
  await Bun.write(join(dir, "src/ambient.d.ts"), "declare const x: number;\n");
  await Bun.write(join(dir, "src/sinwan-preload.ts"), "export {};\n");
  await Bun.write(join(dir, "src/index.ts"), barrel);
  await Bun.write(join(dir, "package.json"), manifest);
  return dir;
}

describe("export map paths", () => {
  test("maps src entries to dist files", () => {
    expect(distModuleFile("overlay.tsx")).toBe("overlay.js");
    expect(distDeclarationFile("dismiss.ts")).toBe("dismiss.d.ts");
    expect(moduleExport("slot.ts")).toEqual({
      types: "./dist/slot.d.ts",
      "sinwan-ui-core:source": "./src/slot.ts",
      import: "./dist/slot.js",
      default: "./dist/slot.js",
    });
  });

  test("discovers every public module in src, excluding the barrel and preload", async () => {
    const modules = await discoverModules(join(ROOT, "src"));
    expect(modules.map((module) => module.name)).toEqual(PUBLIC_MODULES);
    expect(libraryEntrypoints(MODULES)).toEqual(["index.ts", "core.tsx", "dismiss.ts"]);
  });

  test("builds the root export first, then one subpath per module", () => {
    const map = buildExportMap(MODULES);
    expect(Object.keys(map)).toEqual([".", "./core", "./dismiss"]);
    expect(map["./core"]).toEqual(moduleExport("core.tsx"));
  });
});

describe("diffExportMap", () => {
  const expected = buildExportMap(MODULES);

  test("accepts an identical map", () => {
    expect(diffExportMap(structuredClone(expected), expected)).toEqual([]);
  });

  test("rejects a non-object exports field", () => {
    expect(diffExportMap("./dist/index.js", expected)).toEqual(["package.json `exports` must be an object"]);
    expect(diffExportMap(null, expected)).toHaveLength(1);
    expect(diffExportMap([], expected)).toHaveLength(1);
  });

  test("reports missing, changed and unexpected keys", () => {
    const { "./core": _core, ...rest } = expected;
    const actual = { ...rest, "./dismiss": "./dist/dismiss.js", "./extra": "./dist/extra.js" };
    expect(diffExportMap(actual, expected)).toEqual([
      'missing export "./core"',
      'export "./dismiss" differs from generated target',
      'unexpected export "./extra"',
    ]);
  });

  test("reports a reordered map", () => {
    const { ".": root, ...rest } = expected;
    expect(diffExportMap({ ...rest, ".": root }, expected)).toEqual(["export keys are not in generated order"]);
  });
});

describe("diffBarrel", () => {
  test("lists modules missing from the barrel", () => {
    expect(barrelLine(MODULES[0]!)).toBe('export * from "./core";');
    expect(diffBarrel('export * from "./core";\n', MODULES)).toEqual(['src/index.ts does not re-export "./dismiss"']);
  });
});

describe("runExportMap", () => {
  test("package.json exports and the barrel match the src modules", async () => {
    const stdout = collect();
    const stderr = collect();
    expect(await runExportMap(["--check"], ROOT, { stdout, stderr })).toBe(0);
    expect(stderr.text()).toBe("");
    expect(stdout.text()).toContain("package.json exports match 11 generated entries");
  });

  test("--check fails on drift and --write regenerates", async () => {
    const dir = await tempPackage(JSON.stringify({ name: "fixture", exports: { ".": "./x.js" }, files: ["dist"] }));
    try {
      const stdout = collect();
      const stderr = collect();
      expect(await runExportMap([], dir, { stdout, stderr })).toBe(1);
      expect(stderr.text()).toContain('missing export "./core"');
      expect(stderr.text()).toContain("bun run exports:sync");

      expect(await runExportMap(["--write"], dir, { stdout, stderr })).toBe(0);
      expect(stdout.text()).toContain("package.json exports regenerated (3 entries)");
      const written: unknown = JSON.parse(await Bun.file(join(dir, "package.json")).text());
      expect(written).toMatchObject({ name: "fixture", files: ["dist"] });
      expect(await runExportMap(["--check"], dir, { stdout, stderr })).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("fails when the barrel misses a module", async () => {
    const dir = await tempPackage(JSON.stringify({ exports: {} }), 'export * from "./core";\n');
    try {
      const stderr = collect();
      expect(await runExportMap(["--write"], dir, { stdout: collect(), stderr })).toBe(1);
      expect(stderr.text()).toContain('does not re-export "./dismiss"');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  test("rejects a manifest that is not an object", async () => {
    const dir = await tempPackage("[]");
    try {
      const stderr = collect();
      expect(await runExportMap(["--check"], dir, { stdout: collect(), stderr })).toBe(1);
      expect(stderr.text()).toContain("must contain a JSON object");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
