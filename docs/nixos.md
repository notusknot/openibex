# Deploy on NixOS (flake module)

OpenIbex ships a flake with a NixOS module that runs it **on bare metal** — a
plain systemd service, no Docker. It builds the SvelteKit/adapter-node server
(compiling the native `better-sqlite3` against the pinned Node), runs as a
dedicated `openibex` system user, and stores everything under
`/var/lib/openibex`. It binds to `127.0.0.1` and stays behind **your own**
reverse proxy — Caddy, nginx, Traefik, whatever you already run.

> OpenIbex is **not in nixpkgs** yet, so you consume the flake directly as an
> input and pin/update it yourself (see [Updating](#updating) below).

## 1. Add the input and import the module

```nix
# flake.nix
{
  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-25.11";
    openibex.url = "github:notusknot/openibex";
    # Optional but recommended: build OpenIbex against your own nixpkgs.
    openibex.inputs.nixpkgs.follows = "nixpkgs";
  };

  outputs = { nixpkgs, openibex, ... }: {
    nixosConfigurations.myserver = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        openibex.nixosModules.default   # also wires the package via an overlay
        ./configuration.nix
      ];
    };
  };
}
```

## 2. Enable it

The smallest working config — a `SESSION_SECRET` is generated on first start
(stored `0600` under the data dir), so this is all you need to boot. It listens
on `127.0.0.1:3000`:

```nix
# configuration.nix
{
  services.openibex.enable = true;
}
```

Create your account at `/register` — the first user becomes the admin and
registration then closes (set `openRegistration = true` to allow more).

## Behind a reverse proxy

OpenIbex works behind any reverse proxy. Two things matter:

1. Point the proxy at `http://127.0.0.1:3000` (the default bind).
2. Set `services.openibex.origin` to the **public URL** users reach it at.
   adapter-node compares the request `Origin` header against it for CSRF, and
   uses its scheme to decide whether session cookies are marked `Secure` — get
   this wrong and logins/uploads silently fail.

```nix
{
  services.openibex = {
    enable = true;
    origin = "https://openibex.example.com";
  };
}
```

Example `Caddyfile` (Caddy handles TLS automatically):

```
openibex.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

The same applies to nginx/Traefik/etc. — proxy to `127.0.0.1:3000`, terminate
TLS at the proxy, and keep the app port off the public network (no
`openFirewall` needed when the proxy is on the same host).

> **Large FIT / export uploads:** adapter-node caps request bodies at
> 512&nbsp;KB by default, and some proxies add their own cap (nginx defaults to
> 1&nbsp;MB; Caddy has none). A long activity's FIT file can exceed that, and the
> **Settings → Import Garmin export** bulk upload (a whole "Export Your Data"
> archive) is far larger still. Raise the app's limit with
> `services.openibex.settings.BODY_SIZE_LIMIT = "1G";` and lift the proxy's cap
> to match if it has one. (The CLI `pnpm import:garmin` reads straight from disk
> and is unaffected by this limit.)

### Direct access (no proxy)

To reach OpenIbex directly over a LAN/Tailscale address instead, bind to all
interfaces, set `origin`, and open the firewall:

```nix
{
  services.openibex = {
    enable = true;
    host = "0.0.0.0";
    origin = "http://your-host.example.ts.net:3000";
    openFirewall = true;
  };
}
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `services.openibex.enable` | `false` | Enable the service. |
| `services.openibex.host` | `"127.0.0.1"` | Bind address. Use `0.0.0.0` for direct network access. |
| `services.openibex.port` | `3000` | Listen port. |
| `services.openibex.origin` | `http://localhost:<port>` | Public URL, for CSRF / Secure cookies. Set this behind a proxy. |
| `services.openibex.dataDir` | `/var/lib/openibex` | DB, uploads, and stream data. Back this up. |
| `services.openibex.openRegistration` | `false` | Allow registration beyond the first (admin) user. |
| `services.openibex.sessionTtlDays` | `30` | Session lifetime. |
| `services.openibex.logLevel` | `"info"` | pino level; logs go to the journal. |
| `services.openibex.generateSyncEncryptionKey` | `true` | Auto-generate `SYNC_ENCRYPTION_KEY` for Garmin sync (see [Secrets](#secrets)). |
| `services.openibex.environmentFile` | `null` | Secrets file to override the auto-generated keys (e.g. from sops-nix/agenix). |
| `services.openibex.settings` | `{}` | Extra non-secret env vars (e.g. `CALENDAR_*` knobs, `BODY_SIZE_LIMIT`). |
| `services.openibex.openFirewall` | `false` | Open `port` in the firewall. |
| `services.openibex.package` | from the flake | The OpenIbex package to run. |

## Secrets

Both secrets OpenIbex needs are **generated automatically on first boot** into a
single `0600` file (`<dataDir>/secret.env`), owned by the service user and never
written to the world-readable Nix store — so the default deployment is
zero-touch:

- `SESSION_SECRET` — signs session cookies.
- `SYNC_ENCRYPTION_KEY` — encrypts the Garmin session tokens stored by the
  experimental Garmin Connect sync (AES-256-GCM). Auto-generated so the feature
  works the moment you connect an account, with no key wrangling. Turn this off
  with `services.openibex.generateSyncEncryptionKey = false;` to opt out.

**Why this is safe.** The key sits in `secret.env`, *not* in the database, so a
database-only leak — a SQL-injection dump, or someone copying just
`openibex.db` — can't decrypt the tokens; the encryption keeps doing its job.
Both keys live in `dataDir`, so treat it as sensitive and include it in backups
(losing `SYNC_ENCRYPTION_KEY` forces every connected user to reconnect Garmin).

### Bringing your own keys

To manage a key outside the host — e.g. with
[sops-nix](https://github.com/Mic92/sops-nix) or
[agenix](https://github.com/ryantm/agenix) — point `environmentFile` at it. Its
values are layered *on top of* the generated ones, so they win:

```nix
{
  services.openibex.environmentFile = "/run/secrets/openibex.env";
  # File contents (KEY=value per line). Generate with: openssl rand -base64 32
  #   SYNC_ENCRYPTION_KEY=...   # overrides the auto-generated key
  #   SESSION_SECRET=...        # optional: overrides the auto-generated one
}
```

## Updating

Because OpenIbex isn't in nixpkgs, you track it as a flake input and bump it
deliberately:

```bash
nix flake update openibex     # pull the latest OpenIbex revision into flake.lock
sudo nixos-rebuild switch      # rebuild + restart the service
```

That's the whole update story — the build pins its own dependencies (including
the `pnpm` lockfile hash), so bumping the input is all you do. Migrations run
automatically on restart, and the graceful-shutdown handler checkpoints the
database before the old process exits. To pin a specific release, point the
input at a tag (`github:notusknot/openibex/vX.Y.Z`).
