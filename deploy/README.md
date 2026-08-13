# Twenty CRM — Docker build + Cloudflare Zero Trust

Builds the CRM image from **this fork's** source and publishes it through a
`cloudflared` tunnel. Nothing here touches `packages/twenty-docker/`, so
merging upstream never conflicts with the deployment.

The `twenty` build target bundles the frontend into the server, so the whole
app is one origin on port 3000 — a single tunnel hostname covers it.

## 1. Create the tunnel

Zero Trust dashboard → **Networks → Tunnels → Create a tunnel → Cloudflared**.
Name it, then copy the token out of the install command it shows you (the long
string after `--token`). Don't run that command — the compose stack runs the
connector.

Add a **public hostname** on the tunnel:

| Field | Value |
| --- | --- |
| Subdomain / domain | `crm` / `yourdomain.com` |
| Service type | `HTTP` |
| URL | `server:3000` |

`server` is the compose service name — cloudflared resolves it on the private
network, which is why no host port needs to be open.

## 2. Fill in `.env`

`ENCRYPTION_KEY` and `PG_DATABASE_PASSWORD` are already generated. Set the two
TODOs: `CLOUDFLARE_TUNNEL_TOKEN` and `SERVER_URL`.

`SERVER_URL` must match the public hostname exactly (`https://crm.yourdomain.com`,
no trailing slash). The frontend derives its API origin from it, so a mismatch
produces a UI that loads but can't log in.

## 3. Build and start

Build the image from the repo root. Use `docker build` rather than
`docker compose build`: compose refuses to run until every required variable in
`.env` is set, and the image itself needs none of them.

```bash
docker build --target twenty -f packages/twenty-docker/twenty/Dockerfile --build-arg APP_VERSION=2.31.0 -t twenty-crm:local .
```

First build is long — it compiles the server and the frontend from source.

`APP_VERSION` must be valid semver: the app/plugin system refuses to register
apps otherwise, and app engine requirements are compared against it.

Picking the right value is less obvious than it looks. Upstream cuts release
branches, so release tags are generally **not** ancestors of `main` —
`git describe` will report a much older version than you are really running.
Compare against the tag directly instead:

```bash
git log --oneline HEAD..twenty/v2.31.0
```

Empty output, or only trivial fixes, means you are effectively running that
release. Prefer understating over overstating: claiming a version you aren't
running lets incompatible apps install. Compose sets this from `.env` at
runtime, so correcting it later never needs a rebuild.
Then, from `deploy/`:

```bash
docker compose up -d
```

Watch progress with `docker compose logs -f server`; the entrypoint runs
migrations before the app comes up.

Verify:

- `curl http://127.0.0.1:3000/healthz` — app is up locally
- `curl http://127.0.0.1:2000/ready` — tunnel is registered with Cloudflare
- Then load `https://crm.yourdomain.com`

Once the tunnel works, delete the `ports:` block from the `server` service so
the app is reachable *only* through Cloudflare.

## 4. Put Access in front of it

Zero Trust → **Access → Applications → Add an application → Self-hosted**,
hostname `crm.yourdomain.com`, then attach a policy (email domain, IdP group,
whatever you use).

Three things that will bite you if you skip them:

- **API and webhook traffic gets blocked.** Access challenges every request,
  including REST/GraphQL calls carrying a Twenty API key, and anything posting
  to a webhook endpoint. Add a Service Auth policy with a service token, or a
  Bypass policy scoped to those paths.
- **SSO callbacks get blocked.** If you enable Google or Microsoft login in
  Twenty, the OAuth callback paths need a Bypass policy — the IdP can't solve
  an Access challenge.
- **Uploads cap at 100 MB** on Free/Pro/Business plans. Attachments larger
  than that fail at the edge, not in the app.

## Deploying to a server: build here, run there

The recommended path. The build is the only resource-hungry step, so do it on
the workstation and ship the finished image. **The server needs no source
code** — compose skips the `build:` section entirely when the image is already
present and you don't pass `--build`.

First, confirm the architectures match. On the server:

```bash
uname -m
```

`x86_64` matches an ordinary PC — carry on. `aarch64` does not: an amd64 image
will not run there, and you would need
`docker buildx build --platform linux/arm64`, which emulates and is slow.

### On the workstation

Run `deploy/package.sh`, or do it by hand — build from the repo root, then:

```bash
docker save twenty-crm:local | gzip > twenty-crm.tar.gz
```

That yields roughly a 250–300 MB file. Copy three things to the server: the
tarball, `deploy/docker-compose.yml`, and `deploy/.env`. Use `scp` or another
encrypted transfer — `.env` holds your encryption key, database password, and
tunnel token.

### On the server

```bash
gunzip -c twenty-crm.tar.gz | docker load
```

```bash
docker compose up -d
```

No `--build` — that flag would try to rebuild from source that isn't there.
Postgres, Redis, and cloudflared pull their own images from Docker Hub
normally; only the CRM image is hand-delivered.

### Upgrades

Merge upstream on the workstation, rebuild, save, copy, load, then
`docker compose up -d` on the server. Database migrations run automatically on
boot via the entrypoint.

## Notes

- **Build memory.** The frontend build asks for an 8 GB Node heap — this is
  the one step that OOMs on small hosts. See "Build memory" below.
- **`TRUST_PROXY`** already defaults to `loopback, linklocal, uniquelocal`,
  which covers the private compose network cloudflared connects from, so
  `X-Forwarded-Proto: https` is honored with no override.
- **Upgrades.** `git fetch upstream && git merge upstream/main`, then
  `docker compose up -d --build`. The entrypoint runs migrations on boot.
- **Backups.** State lives in the `crm_db-data` and `crm_server-local-data`
  volumes. Nothing here backs them up.
- **Disk.** Repo clone ~530 MB, final image well under 1 GB unpacked. The
  build cache is the big one — budget ~15–25 GB during the build, reclaimable
  afterwards with `docker builder prune`.
- **No registry involved.** The host builds from source, so there is no image
  to push or pull and no registry credentials to manage.

## Build memory

`npx nx build twenty-front` runs with `--max-old-space-size=8192`. Budget
**~12 GB of RAM + swap combined** for the build host — 8 GB of heap plus Node,
yarn, and the rest of the toolchain. Runtime needs far less; this is a
build-time spike only.

### Docker Desktop on Windows (the dev box)

Nothing to do. WSL2 takes ~50% of host RAM by default, which on a 93 GB
machine is ~46 GB available to Docker — no swap required.

To pin it explicitly rather than relying on the default, add to
`%UserProfile%\.wslconfig`, then `wsl --shutdown`:

```
[wsl2]
memory=16GB
swap=8GB
```

### A smaller Linux deploy host

Check what you have first — `free -h`. If RAM + swap is under ~12 GB, add a
swapfile:

```bash
sudo fallocate -l 12G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
```

Make it survive reboot:

```bash
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Confirm with `free -h`, and check the disk can spare 12 GB with `df -h /`.

Be realistic about this: a build whose 8 GB heap lives mostly in swap thrashes
badly and can take hours on a small VPS, especially on network storage. Swap
turns "the build dies" into "the build finishes eventually" — it does not make
it fast. On a genuinely small host, prefer one of these instead:

- Build the frontend on a bigger machine and copy `packages/twenty-front/build/`
  to the deploy host. The Dockerfile detects that directory and skips the
  expensive stage entirely.
- Build the whole image on a bigger machine, `docker save` it to a tarball, and
  `docker load` it on the host.
