import { $ } from "bun";
import { rm } from "node:fs/promises";
import { sinwan } from "bun-plugin-sinwan";
import { checkLibraryDist, sourceUsesSinwan } from "./scripts/dist-check";
import { discoverModules, distModuleFile, libraryEntrypoints, ROOT_ENTRY } from "./scripts/export-map";
import pkg from "./package.json";

const ROOT = import.meta.dir;
const SRC = `${ROOT}/src`;
const DIST = `${ROOT}/dist`;

const SINWAN_EXTERNALS = [
  "sinwan",
  "sinwan/reactivity",
  "sinwan/component",
  "sinwan/control-flow",
  "sinwan/jsx-runtime",
  "sinwan/renderer",
] as const;

async function cleanDist(): Promise<void> {
  console.log("Cleaning dist/");
  await rm(DIST, { recursive: true, force: true });
}

async function emitDeclarations(): Promise<void> {
  console.log("Emitting type declarations");
  await $`bunx tsc -p tsconfig.build.json`.cwd(ROOT);
}

async function readDist(): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const file of new Bun.Glob("**/*.js").scan(DIST)) {
    files.set(file, await Bun.file(`${DIST}/${file}`).text());
  }
  return files;
}

async function assertPeerExternal(entrypoints: readonly string[]): Promise<void> {
  const sinwanEntries: string[] = [];
  for (const entry of entrypoints) {
    if (sourceUsesSinwan(await Bun.file(`${SRC}/${entry}`).text())) sinwanEntries.push(distModuleFile(entry));
  }
  const problems = checkLibraryDist({
    files: await readDist(),
    entries: entrypoints.map(distModuleFile),
    sinwanEntries: [distModuleFile(ROOT_ENTRY), ...sinwanEntries],
    allowedPackages: [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)],
  });
  if (problems.length > 0) {
    throw new Error(
      `sinwan-ui-core dist must keep Sinwan and npm packages as bare imports:\n${problems.join("\n")}`,
    );
  }
}

async function buildLibrary(entrypoints: readonly string[]): Promise<void> {
  console.log(`Bundling ${entrypoints.length} entries with Bun.build + sinwan compiler`);
  const result = await Bun.build({
    entrypoints: entrypoints.map((entry) => `${SRC}/${entry}`),
    outdir: DIST,
    root: SRC,
    target: "browser",
    splitting: true,
    packages: "external",
    jsx: { runtime: "automatic", importSource: "sinwan", development: false },
    naming: {
      entry: "[dir]/[name].[ext]",
      chunk: "chunks/chunk-[hash].[ext]",
      asset: "assets/[name]-[hash].[ext]",
    },
    plugins: [
      sinwan({
        peerExternal: true,
        dev: false,
        derivedLocals: true,
        hoist: true,
      }),
    ],
    external: [...SINWAN_EXTERNALS],
  });
  if (!result.success) {
    for (const log of result.logs) console.error(log);
    throw new Error("Bun.build failed");
  }
  await assertPeerExternal(entrypoints);
}

async function main(): Promise<void> {
  const entrypoints = libraryEntrypoints(await discoverModules(SRC));
  await cleanDist();
  await emitDeclarations();
  await buildLibrary(entrypoints);
  console.log("Build complete -> dist/");
}

main().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
