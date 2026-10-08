# Megaphone

Webinar platform: admins create rooms and share a link; up to 500 viewers join a live
LiveKit session. See [SPEC.md](SPEC.md).

## Local setup

Docker Desktop is the only requirement; PHP, Composer and Node all run in containers.
The stack follows Sentinel's layout (one app image, a container per `APP_ROLE`, an edge
nginx terminating TLS), but lives in this repo: `docker/` and `docker-compose.yml`.

```bash
make setup    # SSL cert; tells you which manual steps are still outstanding
make up       # build images if missing, start everything
make init     # create + seed the database (prompts; destructive after the first run)
```

Two one-off steps need `sudo` (`make setup` reports whichever is missing):

```bash
# Trust the cert (camera/mic need a secure context)
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain docker/edge/ssl/star.megaphone.local.crt

# /etc/hosts
127.0.0.1 megaphone.local
127.0.0.1 mail.megaphone.local
```

| What           | Where                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| App            | https://megaphone.local:9443                                           |
| Mail (Mailpit) | https://mail.megaphone.local:9443                                      |
| Reverb         | `wss://megaphone.local:9443/app` (via the edge proxy)                  |
| LiveKit        | `wss://megaphone.local:9443/rtc` (signal); media on 7891/tcp, 7892/udp |
| MySQL          | `127.0.0.1:33064` (`megaphone` / `secret`)                             |
| Redis          | `127.0.0.1:63793`                                                      |

Log in as the host: `host@megaphone.local` / `password` (seeded by `make init`; change
it with `HOST_NAME`, `HOST_EMAIL`, `HOST_PASSWORD` in `.env`). There is no public sign-up:
Megaphone has a single host for now.

Host ports are chosen to run alongside `lmse-docker` and `sentinel-docker`; the port map
is at the top of `docker-compose.yml`.

## Containers

| Service                                | Runs                                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------------------- |
| `web`                                  | nginx + Octane (Swoole). Installs Composer/npm deps, app key and assets on first boot. |
| `worker`                               | Horizon                                                                                |
| `reverb`                               | Reverb websocket server                                                                |
| `scheduler`                            | cron → `schedule:run`                                                                  |
| `mysql`, `redis`, `livekit`, `mailpit` | infrastructure                                                                         |
| `nginx`                                | edge proxy: TLS, routes `/app` → Reverb, `/rtc` → LiveKit, the rest → `web`            |

## Everyday commands

```bash
make artisan cmd='migrate'
make composer cmd='require vendor/package'
make npm cmd='run build'      # then `make reload`: Octane caches the Vite manifest
make test                     # PHPUnit against the megaphone_test MySQL schema
make pint
make reload                   # pick up PHP changes in Octane
make logs SERVICE=web
make shell-web
make help                     # everything else
```
