import { join } from "node:path";

/**
 * Opt-in condition that resolves to unpublished `src/` files. Only linked workspaces
 * (e.g. the `ui-unitary` lab) may enable it; published tarballs ship `dist/` only.
 */
export const SOURCE_CONDITION = "sinwan-ui-core:source";

/** Conditional export targets for one JS module, in resolution order. */
export interface ModuleExport {
  types: string;
  [SOURCE_CONDITION]: string;
  import: string;
  default: string;
}

export type ExportMap = Record<string, ModuleExport>;

/** A public module: subpath name (`overlay`) and its `src/`-relative file (`overlay.tsx`). */
export interface CoreModule {
  name: string;
  entry: string;
}

/** `src/`-relative module behind the root `.` export. */
export const ROOT_ENTRY = "index.ts";

/** `src/` files that are not public modules. */
const PRIVATE_ENTRIES: readonly string[] = [ROOT_ENTRY, "sinwan-preload.ts"];

const SOURCE_EXTENSION = /\.(ts|tsx)$/;

function withoutExtension(entry: string): string {
  return entry.replace(SOURCE_EXTENSION, "");
}

/** Every top-level `src/*.ts(x)` file except the barrel and the test preload, sorted by name. */
export async function discoverModules(srcDir: string): Promise<CoreModule[]> {
  const modules: CoreModule[] = [];
  for await (const entry of new Bun.Glob("*.{ts,tsx}").scan(srcDir)) {
    if (PRIVATE_ENTRIES.includes(entry) || entry.endsWith(".d.ts")) continue;
    modules.push({ name: withoutExtension(entry), entry });
  }
  return modules.sort((a, b) => a.name.localeCompare(b.name));
}

/** `dist/`-relative JS file emitted for a `src/`-relative entry. */
export function distModuleFile(entry: string): string {
  return `${withoutExtension(entry)}.js`;
}

/** `dist/`-relative declaration file emitted for a `src/`-relative entry. */
export function distDeclarationFile(entry: string): string {
  return `${withoutExtension(entry)}.d.ts`;
}

export function moduleExport(entry: string): ModuleExport {
  const js = `./dist/${distModuleFile(entry)}`;
  return {
    types: `./dist/${distDeclarationFile(entry)}`,
    [SOURCE_CONDITION]: `./src/${entry}`,
    import: js,
    default: js,
  };
}

/** `src/`-relative build entrypoints: the root barrel plus one per subpath export. */
export function libraryEntrypoints(modules: readonly CoreModule[]): string[] {
  return [ROOT_ENTRY, ...modules.map((module) => module.entry)];
}

export function buildExportMap(modules: readonly CoreModule[]): ExportMap {
  const map: ExportMap = { ".": moduleExport(ROOT_ENTRY) };
  for (const module of modules) {
    map[`./${module.name}`] = moduleExport(module.entry);
  }
  return map;
}

/** The barrel line that re-exports a module. */
export function barrelLine(module: CoreModule): string {
  return `export * from "./${module.name}";`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Human-readable differences between a manifest's `exports` and the generated map. */
export function diffExportMap(actual: unknown, expected: ExportMap): string[] {
  if (!isRecord(actual)) return ["package.json `exports` must be an object"];
  const problems: string[] = [];
  for (const [key, target] of Object.entries(expected)) {
    if (!(key in actual)) problems.push(`missing export "${key}"`);
    else if (JSON.stringify(actual[key]) !== JSON.stringify(target)) {
      problems.push(`export "${key}" differs from generated target`);
    }
  }
  for (const key of Object.keys(actual)) {
    if (!(key in expected)) problems.push(`unexpected export "${key}"`);
  }
  if (problems.length === 0 && JSON.stringify(Object.keys(actual)) !== JSON.stringify(Object.keys(expected))) {
    problems.push("export keys are not in generated order");
  }
  return problems;
}

/** Modules the barrel does not re-export with `export * from "./<name>"`. */
export function diffBarrel(barrel: string, modules: readonly CoreModule[]): string[] {
  const lines = new Set(barrel.split("\n").map((line) => line.trim()));
  return modules
    .filter((module) => !lines.has(barrelLine(module)))
    .map((module) => `src/${ROOT_ENTRY} does not re-export "./${module.name}"`);
}

export interface TextSink {
  write(text: string): unknown;
}

export interface ExportMapIo {
  stdout: TextSink;
  stderr: TextSink;
}

/**
 * `--check` (default) fails when `package.json` exports or the barrel drift from
 * the `src/` modules; `--write` regenerates the exports in place.
 */
export async function runExportMap(argv: readonly string[], root: string, io: ExportMapIo): Promise<number> {
  const write = argv.includes("--write");
  const manifestPath = join(root, "package.json");
  const manifest: unknown = JSON.parse(await Bun.file(manifestPath).text());
  if (!isRecord(manifest)) {
    io.stderr.write("package.json must contain a JSON object\n");
    return 1;
  }
  const modules = await discoverModules(join(root, "src"));
  const barrelProblems = diffBarrel(await Bun.file(join(root, "src", ROOT_ENTRY)).text(), modules);
  if (barrelProblems.length > 0) {
    io.stderr.write(`${barrelProblems.map((problem) => `- ${problem}`).join("\n")}\n`);
    return 1;
  }
  const expected = buildExportMap(modules);
  const problems = diffExportMap(manifest["exports"], expected);
  if (problems.length === 0) {
    io.stdout.write(`package.json exports match ${Object.keys(expected).length} generated entries\n`);
    return 0;
  }
  if (write) {
    await Bun.write(manifestPath, `${JSON.stringify({ ...manifest, exports: expected }, null, 2)}\n`);
    io.stdout.write(`package.json exports regenerated (${Object.keys(expected).length} entries)\n`);
    return 0;
  }
  io.stderr.write(`${problems.map((problem) => `- ${problem}`).join("\n")}\nRun \`bun run exports:sync\` to regenerate.\n`);
  return 1;
}

if (import.meta.main) process.exit(await runExportMap(process.argv.slice(2), join(import.meta.dir, ".."), process));
