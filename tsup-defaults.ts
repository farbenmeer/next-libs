import { defineConfig } from "tsup";

interface ExportDef {
  node: string;
  import: string;
  require: string;
  types: string;
}

interface PkgJson {
  name: string;
  description: string;
  version: string;
  author: string;
  license: string;
  main?: string;
  module?: string;
  types?: string;
  since: number;
  exports?: ExportDef | ExportDef[];
  optionalDependencies?: Record<string, string>;
}

function arrayWrap<T>(it: T): T extends any[] ? T : T[] {
  return Array.isArray(it) ? (it as any) : [it];
}

function entries(pkg: PkgJson) {
  const exports = arrayWrap(
    pkg.exports ?? {
      node: "./",
      import: pkg.module,
      require: pkg.main,
      types: pkg.types,
    }
  );
  return exports.map(({ types }) => types.replace("dist", "src").replace(".d.ts", ".ts"));
}

function externals(pkg: PkgJson) {
  return Object.keys(pkg.optionalDependencies ?? {});
}

function dateRange(since: number) {
  const now = new Date().getFullYear();
  if (now === since) return since;
  return `${since} - ${now}`;
}

function banner(pkg: PkgJson) {
  const lines = [pkg.name, pkg.description, `© ${dateRange(pkg.since)} ${pkg.author}`, `@license ${pkg.license}`]
    .filter((it) => it)
    .map(String);
  return `/**!${lines.map((line) => `\n * ${line}`)}\n */`;
}

export function tsupDefaults(pkg: PkgJson) {
  const external = externals(pkg);
  const entry = entries(pkg);
  return defineConfig(async ({ watch }) => ({
    entry,
    target: "node18",
    external,
    dts: !watch,
    minify: false,
    format: watch ? ["cjs"] : ["esm", "cjs"],
    sourcemap: !watch,
    onSuccess: watch ? "pnpm run start" : undefined,
    banner: { js: banner(pkg) },
    clean: true,
  }));
}
