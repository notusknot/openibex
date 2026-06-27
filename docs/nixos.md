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

> **Large FIT uploads:** adapter-node caps request bodies at 512&nbsp;KB by
> default, and some proxies add their own cap (nginx defaults to 1&nbsp;MB;
> Caddy has none). A long activity's FIT file can exceed that. Raise the app's
> limit with `services.openibex.settings.BODY_SIZE_LIMIT = "100M";` and lift the
> proxy's cap to match if it has one.

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
| `services.openibex.environmentFile` | `null` | Secrets file (e.g. for `SYNC_ENCRYPTION_KEY`, or to pin `SESSION_SECRET`). |
| `services.openibex.settings` | `{}` | Extra non-secret env vars (e.g. `CALENDAR_*` knobs, `BODY_SIZE_LIMIT`). |
| `services.openibex.openFirewall` | `false` | Open `port` in the firewall. |
| `services.openibex.package` | from the flake | The OpenIbex package to run. |

## Secrets

`SESSION_SECRET` is generated automatically on first boot. The optional
**experimental Garmin Connect sync** needs `SYNC_ENCRYPTION_KEY`
(`openssl rand -base64 32`) — provide it (and anything else you'd rather not put
in the Nix store) through an `environmentFile`, e.g. with
[sops-nix](https://github.com/Mic92/sops-nix) or
[agenix](https://github.com/ryantm/agenix):

```nix
{
  services.openibex.environmentFile = "/run/secrets/openibex.env";
  # File contents (KEY=value per line):
  #   SYNC_ENCRYPTION_KEY=...
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
