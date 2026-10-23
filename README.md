# Projectory

Self-hosted notebook for a team's app projects: repositories, mockups, environments, deployment URLs, releases, test accounts and `.env` files. Secrets are encrypted at rest.

Plan and decisions: [docs/PLAN.md](docs/PLAN.md). Security setup and what to do when something goes wrong: [docs/SECURITY.md](docs/SECURITY.md).

## Run with Docker

```bash
cp .env.example .env
# fill in NUXT_MASTER_KEY and BETTER_AUTH_SECRET:
#   openssl rand -base64 32
docker compose up -d --build
```

Open http://localhost:4747 and create the first account. It becomes the **Master**, who adds everyone else on the **Users** page:

| Role | Can |
|---|---|
| Master | Everything a Super User can, plus adding, changing and removing Super Users. There is exactly one, and nobody can change it in the app ([moving it](docs/SECURITY.md#313-memindahkan-master-ke-orang-lain) takes SQL on the server) |
| Super User | Groups and their access codes, projects, tech stacks; adds and manages Maintainers and Viewers |
| Maintainer | Create, edit and delete projects and everything inside them; see passwords and `.env` |
| Viewer | Read only; no passwords or `.env` values; export without secrets |

Every account must set up **two-factor authentication** (an authenticator app such as Google Authenticator) at its first sign-in. A browser can be trusted for 30 days, after which it asks for a code again. If someone loses their phone, the Master or a Super User resets their two-factor on the **Users** page.

Projects live in **groups** (Group → Project → App). A group can have an access code; maintainers and viewers enter it once per session to open the group. Five wrong codes block that user from the group for 15 minutes.

Other things worth knowing:

- **Ctrl+K** searches projects, URLs, branches, accounts and `.env` keys. Secret values are never searched.
- Deleted projects go to the **Trash** and can be restored for 30 days.
- The **Infrastructure** tab lists servers, Rancher clusters, databases and VPNs per environment: addresses and notes only, never credentials.
- Every `.env` change is kept in its **history** (last 50 versions) and can be restored.
- The **Audit log** (Master and Super User) records secret reveals, exports, project deletes, access code use and user changes.
- Users are signed out after an hour without activity.
- Retention and timeout values live in `shared/utils/constants.ts`.

```bash
docker compose up -d            # start
docker compose down             # stop (data is kept)
docker compose up -d --build    # rebuild after code changes
```

Uploaded images live in `./data/uploads`, the database in the `postgres-data` volume. `docker compose down -v` deletes the database volume.

## Develop

Requires Node 24 and pnpm.

```bash
cp .env.example .env            # fill in the two secrets
docker compose stop app         # free port 4747 if the Docker app is running
docker compose up -d postgres   # database only
nvm use 24
pnpm install
pnpm dev                        # http://localhost:4747
```

Migrations and the built-in tech stack seed run automatically on server start.

| Script | |
|---|---|
| `pnpm dev` | Dev server on http://localhost:4747 |
| `pnpm db:generate` | Create a migration after changing `server/db/schema.ts` |
| `pnpm db:studio` | Browse the database with Drizzle Studio |
| `pnpm lint` / `pnpm typecheck` | Checks |

## Configuration

| Variable | |
|---|---|
| `NUXT_MASTER_KEY` | 32-byte base64 key that encrypts passwords and `.env` values |
| `BETTER_AUTH_SECRET` | Signs sessions and encrypts two-factor secrets. Changing it signs everyone out and resets their two-factor |
| `BETTER_AUTH_URL` | URL you open the app on (default `http://localhost:4747`) |
| `NUXT_DATABASE_URL` | Postgres URL (set automatically inside Docker Compose) |
| `APP_PORT`, `POSTGRES_PORT` | Host ports |

Colors live in `app/app.config.ts` (semantic colors) and `app/assets/css/main.css` (background tokens). UI text is in `i18n/locales/en.json` and `id.json`.

## Backups

- Database: `docker compose exec postgres pg_dump -U projectory projectory > backup.sql`
- Uploads: copy `./data/uploads`
- Keep `NUXT_MASTER_KEY` and `BETTER_AUTH_SECRET` somewhere safe and **separate** from the backups. Without the master key, stored secrets can't be decrypted.

To move a single project to another instance, use **Export** on the project page and **Import** on the projects list.

## Troubleshooting

**Database connection timeouts while a VPN is on.** Some corporate VPNs route `172.16.0.0/12` or `10.0.0.0/8`, which breaks Docker's port forwarding. The Compose network is pinned to `192.168.237.0/24` to avoid this; change the subnet in `docker-compose.yml` if your VPN routes that range too.
