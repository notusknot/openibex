{
  description = "OpenIbex — self-hosted training platform for endurance athletes";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
  };

  outputs =
    { self, nixpkgs, ... }:
    let
      # Systems we expose builds for. Only x86_64-linux is regularly built/tested;
      # aarch64-linux is offered for ARM self-hosters (e.g. SBCs) but unverified.
      systems = [
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      # Adds `openibex` to a pkgs set. Importing nixosModules.default wires this
      # automatically; standalone consumers can add it to nixpkgs.overlays.
      overlays.default = final: _prev: {
        openibex = final.callPackage ./nix/package.nix { };
      };

      packages = forAllSystems (pkgs: rec {
        openibex = pkgs.callPackage ./nix/package.nix { };
        default = openibex;
      });

      # NixOS module for self-hosting on bare metal. `nixosModules.default`
      # also injects the package via an overlay so `services.openibex.package`
      # has a sensible default built from this same flake revision.
      nixosModules.openibex = ./nix/module.nix;
      nixosModules.default = {
        imports = [ self.nixosModules.openibex ];
        nixpkgs.overlays = [ self.overlays.default ];
      };

      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = with pkgs; [
            # Core developer tools
            git
            gh
            gnumake
            just
            curl
            wget
            jq
            ripgrep
            fd
            tree
            sloc

            # JavaScript / TypeScript / SvelteKit
            nodejs_22
            pnpm
            typescript

            # SQLite / Drizzle
            sqlite
            sqlite-utils

            # Native build dependencies for better-sqlite3
            python3
            gcc
            gnumake
            pkg-config

            # Deployment / self-hosting
            docker
            docker-compose

            # Optional but useful
            openssl
            cacert
          ];

          shellHook = ''
            export OPENIBEX_ENV=development
            export NODE_ENV=development

            export DATABASE_URL="file:./data/openibex.db"
            export OPENIBEX_DATA_DIR="./data"
            export OPENIBEX_UPLOAD_DIR="./data/uploads"
            export OPENIBEX_STREAM_DIR="./data/streams"

            mkdir -p "$OPENIBEX_UPLOAD_DIR" "$OPENIBEX_STREAM_DIR"

            echo "OpenIbex development shell"
            echo "DATABASE_URL=$DATABASE_URL"
            echo ""
            echo "Useful commands:"
            echo "  pnpm install"
            echo "  pnpm dev"
            echo "  pnpm db:generate"
            echo "  pnpm db:migrate"
            echo "  pnpm test"
            echo "  docker compose up -d --build"
          '';
        };
      });
    };
}
