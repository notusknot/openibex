{
  lib,
  stdenv,
  nodejs_22,
  pnpm_10,
  python3,
  node-gyp,
  makeWrapper,
}:

# Bare-metal (no Docker) build of the OpenIbex SvelteKit/adapter-node server.
#
# The build runs `pnpm build` (vite) to produce the adapter-node bundle under
# `build/`, then ships that bundle alongside a *production* `node_modules` and
# the `drizzle/` migrations. `better-sqlite3` is a native module that adapter-node
# leaves external, so it must be present (and compiled against THIS nodejs) at
# runtime — which is why we keep node_modules rather than only the bundle.
#
# `ensureMigrations()` does `path.resolve('drizzle')`, i.e. it reads migrations
# relative to the process CWD. The wrapper therefore `--chdir`s into the install
# dir so the server finds `drizzle/` and resolves `better-sqlite3` from the
# colocated node_modules.

let
  nodejs = nodejs_22;
  pnpm = pnpm_10;

  # package.json is the source of truth for the version.
  packageJson = lib.importJSON ../package.json;
in
stdenv.mkDerivation (finalAttrs: {
  pname = "openibex";
  version = packageJson.version;

  # Only the inputs the build actually needs. Excludes the heavy/irrelevant
  # working-tree dirs so a dirty checkout (a populated ./data, a stale ./build)
  # neither bloats the store path nor busts the build cache.
  src =
    let
      root = ./..;
      ignoredTopLevel = [
        "node_modules"
        "build"
        ".svelte-kit"
        ".direnv"
        "data"
        ".git"
        ".github"
        ".githooks"
        ".gstack"
        ".claude"
        "nix"
        "result"
      ];
    in
    lib.cleanSourceWith {
      src = root;
      name = "openibex-source";
      filter =
        path: type:
        let
          rel = lib.removePrefix (toString root + "/") (toString path);
          top = lib.head (lib.splitString "/" rel);
          base = baseNameOf path;
        in
        !(builtins.elem top ignoredTopLevel)
        # Never leak local secrets/env into the store; .env.example is not needed
        # to build.
        && !(lib.hasPrefix ".env" base)
        && !(lib.hasSuffix ".log" base);
    };

  pnpmDeps = pnpm.fetchDeps {
    inherit (finalAttrs) pname version src;
    fetcherVersion = 3;
    # Regenerate after any pnpm-lock.yaml change: set to lib.fakeHash, run
    # `nix build .#openibex`, and paste the hash from the mismatch error.
    hash = "sha256-UXE8X/n3lKPPpx0qWVELcmhq3NFiwsGKGMThMsQWcO8=";
  };

  nativeBuildInputs = [
    nodejs
    pnpm.configHook # offline `pnpm install` from pnpmDeps (always --ignore-scripts)
    python3 # node-gyp dependency
    node-gyp # compiles better-sqlite3
    makeWrapper
  ];

  # The config hook installs with --ignore-scripts, so native modules are never
  # built during install — we compile better-sqlite3 explicitly below. Force a
  # source build: there is no network for prebuild-install in the sandbox, and a
  # generic prebuilt binary would not link against the Nix stdenv anyway.
  env = {
    npm_config_build_from_source = "true";
    npm_config_nodedir = "${nodejs}";
  };

  buildPhase = ''
    runHook preBuild
    pnpm build
    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    # Re-resolve node_modules to production deps only (drops vite, svelte-kit,
    # etc. from the runtime closure), reusing the same offline store the config
    # hook set up. This recreates node_modules, so compile better-sqlite3 AFTER.
    pnpm install --prod --offline --frozen-lockfile --ignore-scripts
    pnpm rebuild better-sqlite3

    dest=$out/share/openibex
    mkdir -p "$dest"
    cp -r build node_modules drizzle package.json "$dest"/

    makeWrapper ${lib.getExe nodejs} $out/bin/openibex \
      --add-flags "$dest/build" \
      --chdir "$dest"

    runHook postInstall
  '';

  meta = {
    description = "Self-hosted training platform for endurance athletes (bare-metal server)";
    homepage = "https://github.com/notusknot/openibex";
    license = lib.licenses.mit;
    mainProgram = "openibex";
    platforms = lib.platforms.linux;
  };
})
