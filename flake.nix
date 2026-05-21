{
  description = "OpenIbex";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
  };

  outputs = { self, nixpkgs, ... }:
    let
      system = "x86_64-linux";
      pkgs = nixpkgs.legacyPackages.${system};
    in {
      devShells.${system}.default = pkgs.mkShell {
        packages = with pkgs; [
          # Core developer tools
          git
          gnumake
          just
          curl
          wget
          jq
          ripgrep
          fd
          tree

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
    };
}
