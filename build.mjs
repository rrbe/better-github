import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "fs";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });

// Copy static files to dist
cpSync("static", "dist", { recursive: true });
cpSync("src/styles", "dist/styles", { recursive: true });

const sharedOptions = {
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: !watch,
};

const ctx = await esbuild.context({
  ...sharedOptions,
  entryPoints: ["src/content.ts"],
  outfile: "dist/content.js",
});

const optionsCtx = await esbuild.context({
  ...sharedOptions,
  entryPoints: ["src/options.ts"],
  outfile: "dist/options.js",
});

if (watch) {
  await Promise.all([ctx.watch(), optionsCtx.watch()]);
  console.log("Watching for changes...");
} else {
  await Promise.all([ctx.rebuild(), optionsCtx.rebuild()]);
  await Promise.all([ctx.dispose(), optionsCtx.dispose()]);
  console.log("Build complete.");
}
