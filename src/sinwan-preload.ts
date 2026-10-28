import { plugin } from "bun";
import { transformJSX } from "sinwan-compiler";

// Minimal test-only transform plugin: applies the sinwan compiler with
// derivedLocals: true so plain expressions in components are auto-promoted
// to live getters. No onResolve, no cache, no HMR — avoids keeping the
// test process alive after suite completion.
plugin({
  name: "sinwan-test-transform",
  setup(build) {
    build.onLoad({ filter: /\.[tj]sx$/ }, async (args) => {
      const code = await Bun.file(args.path).text();
      try {
        const transformed = transformJSX(code, args.path, {
          hoist: true,
          explicitBindings: false,
          derivedLocals: true,
          dev: false,
        });
        return {
          contents: transformed.code,
          loader: args.path.endsWith("x") ? "tsx" : "ts",
        };
      } catch (err) {
        const text = err instanceof Error ? err.message : String(err);
        return {
          contents: `throw new Error(${JSON.stringify(text)});`,
          loader: args.path.endsWith("x") ? "tsx" : "ts",
        };
      }
    });
  },
});
