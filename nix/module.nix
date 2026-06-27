{
  config,
  lib,
  pkgs,
  ...
}:

let
  cfg = config.services.openibex;

  # Effective external origin. adapter-node uses ORIGIN for its CSRF check and
  # OpenIbex marks session cookies Secure when it is https. Behind a reverse
  # proxy this must be the public URL users actually reach OpenIbex at; we fall
  # back to a local URL and warn (below) when it is left unset.
  origin =
    if cfg.origin != null then cfg.origin else "http://localhost:${toString cfg.port}";

  # Persistent, per-install SESSION_SECRET. Generated on first start into the
  # data dir (0600) instead of the world-readable Nix store. A user-supplied
  # environmentFile is layered on top and can override it / add other secrets
  # (e.g. SYNC_ENCRYPTION_KEY).
  secretEnvFile = "${cfg.dataDir}/secret.env";

  # Secrets generated on first start, one base64 32-byte value per line, into a
  # single 0600 file owned by the service user — never the world-readable Nix
  # store. SYNC_ENCRYPTION_KEY lives here, in a *separate file from the database*,
  # so a DB-only leak (SQL injection, or copying just openibex.db) still can't
  # decrypt the stored Garmin tokens.
  generatedKeys = [ "SESSION_SECRET" ] ++ lib.optional cfg.generateSyncEncryptionKey "SYNC_ENCRYPTION_KEY";

  # Each key is (re)generated only if absent, so this is idempotent across
  # restarts and never clobbers a value you pin via environmentFile.
  preStart = pkgs.writeShellScript "openibex-pre-start" ''
    set -eu
    umask 077
    touch ${lib.escapeShellArg secretEnvFile}
    chmod 600 ${lib.escapeShellArg secretEnvFile}

    ensure_key() {
      if ! grep -q "^$1=" ${lib.escapeShellArg secretEnvFile}; then
        printf '%s=%s\n' "$1" "$(${lib.getExe pkgs.openssl} rand -base64 32)" \
          >> ${lib.escapeShellArg secretEnvFile}
      fi
    }

    ${lib.concatMapStringsSep "\n    " (k: "ensure_key ${k}") generatedKeys}
  '';
in
{
  options.services.openibex = {
    enable = lib.mkEnableOption "the OpenIbex self-hosted training platform";

    package = lib.mkOption {
      type = lib.types.package;
      default = pkgs.openibex or (throw "services.openibex.package must be set (or use the flake's nixosModules.default, which provides it).");
      defaultText = lib.literalExpression "pkgs.openibex";
      description = "The OpenIbex package to run.";
    };

    host = lib.mkOption {
      type = lib.types.str;
      default = "127.0.0.1";
      description = ''
        Address the server binds to. The default keeps OpenIbex local-only — put
        your own reverse proxy (Caddy, nginx, …) in front of it. Set to `0.0.0.0`
        to expose it directly on the network (e.g. for access over a Tailscale/LAN
        address).
      '';
    };

    port = lib.mkOption {
      type = lib.types.port;
      default = 3000;
      description = "Port the server listens on.";
    };

    origin = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      example = "https://openibex.example.com";
      description = ''
        Canonical external URL — the address users reach OpenIbex at. Required by
        adapter-node's CSRF check in production and used to decide whether session
        cookies are marked Secure. Behind a reverse proxy set this to your public
        https URL. Defaults to `http://localhost:<port>` when unset.
      '';
    };

    dataDir = lib.mkOption {
      type = lib.types.path;
      default = "/var/lib/openibex";
      description = ''
        Directory holding the SQLite database, uploads, and stream data. Back
        this up to back up OpenIbex. Created automatically with the right owner.
      '';
    };

    user = lib.mkOption {
      type = lib.types.str;
      default = "openibex";
      description = "User the service runs as. A system user is created when left at the default.";
    };

    group = lib.mkOption {
      type = lib.types.str;
      default = "openibex";
      description = "Group the service runs as. Created when left at the default.";
    };

    openRegistration = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        Allow registration beyond the first user. The first account to register
        always becomes the admin; after that, registration is closed unless this
        is set.
      '';
    };

    sessionTtlDays = lib.mkOption {
      type = lib.types.ints.positive;
      default = 30;
      description = "Session lifetime in days.";
    };

    logLevel = lib.mkOption {
      type = lib.types.enum [
        "fatal"
        "error"
        "warn"
        "info"
        "debug"
        "trace"
        "silent"
      ];
      default = "info";
      description = "pino log level. Logs are JSON on stdout (captured by the journal).";
    };

    generateSyncEncryptionKey = lib.mkOption {
      type = lib.types.bool;
      default = true;
      description = ''
        Generate a `SYNC_ENCRYPTION_KEY` on first start (alongside `SESSION_SECRET`,
        in the same `0600` file outside the Nix store) so the experimental Garmin
        Connect sync works with no manual key management. The key encrypts stored
        Garmin session tokens (AES-256-GCM) and lives in a separate file from the
        database, so a database-only leak can't decrypt them.

        Override it any time by setting `SYNC_ENCRYPTION_KEY` in
        {option}`services.openibex.environmentFile` — that takes precedence. Set
        this to `false` to manage the key entirely yourself or to opt out.

        Note: losing or rotating the key makes existing encrypted tokens
        unreadable, so every connected user must reconnect Garmin. Back up
        {option}`services.openibex.dataDir` (which holds this file) to preserve it.
      '';
    };

    environmentFile = lib.mkOption {
      type = lib.types.nullOr lib.types.path;
      default = null;
      example = "/run/secrets/openibex.env";
      description = ''
        Optional path to an EnvironmentFile (e.g. from sops-nix/agenix) layered on
        top of the auto-generated secrets, so its values win. Use it to pin your
        own `SESSION_SECRET` or `SYNC_ENCRYPTION_KEY` (`openssl rand -base64 32`) —
        for instance to manage the key outside the host. Lines are `KEY=value`.
      '';
    };

    settings = lib.mkOption {
      type = lib.types.attrsOf lib.types.str;
      default = { };
      example = lib.literalExpression ''
        {
          CALENDAR_SYNC_HORIZON_DAYS = "90";
        }
      '';
      description = ''
        Extra environment variables passed verbatim to the service — an escape
        hatch for tuning knobs not exposed as dedicated options (e.g. the
        calendar-sync `CALENDAR_*` settings). Non-secret values only; these land
        in the Nix store. Put secrets in {option}`services.openibex.environmentFile`.
      '';
    };

    openFirewall = lib.mkOption {
      type = lib.types.bool;
      default = false;
      description = ''
        Open {option}`services.openibex.port` in the firewall. Only needed when
        reaching the server directly, rather than via a reverse proxy on the same
        host.
      '';
    };
  };

  config = lib.mkIf cfg.enable {
    warnings = lib.optional (cfg.origin == null) ''
      services.openibex: `origin` is unset, so ORIGIN defaults to http://localhost:${toString cfg.port}.
      Behind a reverse proxy (Caddy, nginx, Traefik, …) set services.openibex.origin to the public URL
      users actually reach OpenIbex at, or logins and uploads will fail adapter-node's CSRF origin check.
    '';

    users.users = lib.mkIf (cfg.user == "openibex") {
      openibex = {
        isSystemUser = true;
        group = cfg.group;
        home = cfg.dataDir;
        description = "OpenIbex service user";
      };
    };

    users.groups = lib.mkIf (cfg.group == "openibex") {
      openibex = { };
    };

    systemd.tmpfiles.rules = [
      "d ${cfg.dataDir} 0750 ${cfg.user} ${cfg.group} - -"
    ];

    systemd.services.openibex = {
      description = "OpenIbex training platform";
      wantedBy = [ "multi-user.target" ];
      after = [ "network.target" ];

      environment = {
        NODE_ENV = "production";
        OPENIBEX_ENV = "production";
        HOST = cfg.host;
        PORT = toString cfg.port;
        ORIGIN = origin;
        DATABASE_URL = "file:${cfg.dataDir}/openibex.db";
        OPENIBEX_DATA_DIR = cfg.dataDir;
        OPENIBEX_UPLOAD_DIR = "${cfg.dataDir}/uploads";
        OPENIBEX_STREAM_DIR = "${cfg.dataDir}/streams";
        OPENIBEX_EXPORT_DIR = "${cfg.dataDir}/exports";
        OPENIBEX_IMPORT_DIR = "${cfg.dataDir}/imports";
        OPEN_REGISTRATION = lib.boolToString cfg.openRegistration;
        SESSION_TTL_DAYS = toString cfg.sessionTtlDays;
        LOG_LEVEL = cfg.logLevel;
      }
      // cfg.settings;

      serviceConfig = {
        ExecStartPre = "+${preStart}";
        ExecStart = lib.getExe cfg.package;
        # secret.env first (auto-generated), then the user's file so it can
        # override SESSION_SECRET / add SYNC_ENCRYPTION_KEY.
        EnvironmentFile =
          [ secretEnvFile ] ++ lib.optional (cfg.environmentFile != null) cfg.environmentFile;
        User = cfg.user;
        Group = cfg.group;
        Restart = "on-failure";
        RestartSec = 5;
        # Give the graceful-shutdown handler time to drain writes + checkpoint
        # the WAL before SIGKILL.
        TimeoutStopSec = 30;

        # Hardening. Note: MemoryDenyWriteExecute is intentionally NOT set — V8's
        # JIT needs W^X-violating mappings and Node would crash under it.
        ReadWritePaths = [ cfg.dataDir ];
        ProtectSystem = "strict";
        ProtectHome = true;
        PrivateTmp = true;
        PrivateDevices = true;
        NoNewPrivileges = true;
        ProtectKernelTunables = true;
        ProtectKernelModules = true;
        ProtectControlGroups = true;
        RestrictAddressFamilies = [
          "AF_INET"
          "AF_INET6"
          "AF_UNIX"
        ];
        RestrictNamespaces = true;
        LockPersonality = true;
        RestrictRealtime = true;
        SystemCallFilter = [
          "@system-service"
          "~@privileged"
          "~@resources"
        ];
        SystemCallArchitectures = "native";
        # Binding a privileged port (<1024) directly needs this capability.
        CapabilityBoundingSet = lib.mkIf (cfg.port < 1024) [ "CAP_NET_BIND_SERVICE" ];
        AmbientCapabilities = lib.mkIf (cfg.port < 1024) [ "CAP_NET_BIND_SERVICE" ];
      };
    };

    networking.firewall = lib.mkIf cfg.openFirewall {
      allowedTCPPorts = [ cfg.port ];
    };
  };
}
