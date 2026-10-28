import { posix } from "node:path";

/**
 * Text that only appears when a Sinwan runtime (or another package) was inlined
 * into the library output instead of staying a bare import:
 * - `pendingEffects`: internal of the Sinwan reactivity runtime.
 * - `/_chunks/`: Sinwan's own `dist/esm/_chunks` directory (library chunks use `chunks/`).
 * - `sinwan/dist/`, `node_modules/`: path comments Bun writes above inlined modules.
 */
export const INLINED_RUNTIME_MARKERS: readonly string[] = [
  "pendingEffects",
  "/_chunks/",
  "sinwan/dist/",
  "node_modules/",
];

/** Bun emits `jsxDEV` imports from here unless the build sets `jsx.development: false`. */
export const DEV_JSX_RUNTIME = "sinwan/jsx-dev-runtime";

const JS_SCANNER = new Bun.Transpiler({ loader: "js" });
const SOURCE_SCANNER = new Bun.Transpiler({
  loader: "tsx",
  tsconfig: { compilerOptions: { jsx: "react-jsx", jsxImportSource: "sinwan" } },
});

export function isRelativeSpecifier(specifier: string): boolean {
  return specifier.startsWith("./") || specifier.startsWith("../");
}

/** npm package name of a bare specifier: `sinwan/reactivity` → `sinwan`, `@a/b/c` → `@a/b`. */
export function packageName(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : (parts[0] ?? specifier);
}

export function isSinwanSpecifier(specifier: string): boolean {
  return packageName(specifier) === "sinwan";
}

export function scanSpecifiers(code: string): string[] {
  return JS_SCANNER.scanImports(code).map((entry) => entry.path);
}

/** Whether a `.ts`/`.tsx` source imports Sinwan, including the JSX runtime TSX implies. */
export function sourceUsesSinwan(source: string): boolean {
  return SOURCE_SCANNER.scanImports(source).some((entry) => isSinwanSpecifier(entry.path));
}

/** `dist/`-relative files reachable from `entry` through relative imports, entry included. */
export function moduleGraph(files: ReadonlyMap<string, string>, entry: string): string[] {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    const code = files.get(file);
    if (seen.has(file) || code === undefined) continue;
    seen.add(file);
    for (const specifier of scanSpecifiers(code)) {
      if (isRelativeSpecifier(specifier)) queue.push(posix.join(posix.dirname(file), specifier));
    }
  }
  return [...seen];
}

export interface LibraryDistInput {
  /** `dist/`-relative path → emitted JS for every library file. */
  files: ReadonlyMap<string, string>;
  /** `dist/`-relative entry files that must exist. */
  entries: readonly string[];
  /** Entries whose source uses Sinwan; their module graph must import bare `sinwan/*`. */
  sinwanEntries: readonly string[];
  /** Packages the library may import bare (dependencies and peers). */
  allowedPackages: readonly string[];
}

export function checkLibraryDist(input: LibraryDistInput): string[] {
  const problems: string[] = [];
  const allowed = new Set(input.allowedPackages);
  for (const [file, code] of input.files) {
    for (const marker of INLINED_RUNTIME_MARKERS) {
      if (code.includes(marker)) problems.push(`${file}: contains "${marker}" (inlined runtime or package)`);
    }
    for (const specifier of scanSpecifiers(code)) {
      if (specifier === DEV_JSX_RUNTIME) {
        problems.push(`${file}: imports the development JSX runtime "${DEV_JSX_RUNTIME}"`);
      } else if (isRelativeSpecifier(specifier)) {
        const target = posix.join(posix.dirname(file), specifier);
        if (!input.files.has(target)) problems.push(`${file}: imports missing file "${specifier}"`);
      } else if (!allowed.has(packageName(specifier))) {
        problems.push(`${file}: imports undeclared package "${specifier}"`);
      }
    }
  }
  for (const entry of input.entries) {
    if (!input.files.has(entry)) problems.push(`missing entry ${entry}`);
  }
  for (const entry of input.sinwanEntries) {
    const graph = moduleGraph(input.files, entry);
    const importsSinwan = graph.some((file) => scanSpecifiers(input.files.get(file) ?? "").some(isSinwanSpecifier));
    if (!importsSinwan) problems.push(`${entry}: uses Sinwan but its graph has no bare sinwan/* import`);
  }
  return problems;
}
