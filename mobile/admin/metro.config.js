// Metro, taught to see outside its own directory.
//
// This app lives at mobile/admin, but its shared code lives in
// frontend/packages/* — deliberately, so Expo's dependency tree never enters
// the web apps' install or CI (see mobile/CLAUDE.md). npm links those packages
// in as `file:` dependencies, which makes them SYMLINKS into a directory Metro
// would otherwise refuse to read from: by default it only watches the project
// root, so importing @minigames/admin-core would resolve and then fail to
// bundle.
//
// `watchFolders` fixes that by adding the real paths. Editing a shared
// calculation then hot-reloads here exactly as it does in the Vite apps.

const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..", "..");

const config = getDefaultConfig(projectRoot);

// The shared packages are TypeScript SOURCE, not built output, so Metro
// compiles them with the app. That is the same trade the Vite aliases make:
// no build step between editing a calculation and seeing it run.
config.watchFolders = [path.resolve(repoRoot, "frontend", "packages")];

// Resolve dependencies from this app first, then fall back to the repo root.
// Hierarchical lookup stays ON: the shared packages have no node_modules of
// their own, so a symlinked import of `react` must be allowed to walk up and
// find the single copy installed here. Two copies of React is the classic
// monorepo RN failure, and this is the line that prevents it.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(repoRoot, "node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
