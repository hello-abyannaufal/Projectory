# Projectory

Self-hosted notebook for a team's app projects: repositories, mockups, environments, deployment URLs, releases, test accounts and `.env` files. Secrets are encrypted at rest.

Plan and decisions: [docs/PLAN.md](docs/PLAN.md).

## Run with Docker

```bash
cp .env.example .env
# fill in NUXT_MASTER_KEY and BETTER_AUTH_SECRET:
#   openssl rand -base64 32
docker compose up -d --build
```

Open http://localhost:4747 and create the first account. It becomes the **Super User**, who adds everyone else on the **Users** page:

| Role | Can |
|---|---|
| Super User | Everything: groups and their access codes, projects, tech stacks, users |
| Maintainer | Create, edit and delete projects and everything inside them; see passwords and `.env` |
| Viewer | Read only; no passwords or `.env` values; export without secrets |

Projects live in **groups** (Group → Project → App). A group can have an access code; maintainers and viewers enter it once per session to open the group.

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
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | URL you open the app on (default `http://localhost:4747`) |
| `NUXT_DATABASE_URL` | Postgres URL (set automatically inside Docker Compose) |
| `APP_PORT`, `POSTGRES_PORT` | Host ports |

Colors live in `app/app.config.ts` (semantic colors) and `app/assets/css/main.css` (background tokens). UI text is in `i18n/locales/en.json` and `id.json`.

## Backups

- Database: `docker compose exec postgres pg_dump -U projectory projectory > backup.sql`
- Uploads: copy `./data/uploads`
- Keep `NUXT_MASTER_KEY` somewhere safe and **separate** from the backups. Without it, stored secrets can't be decrypted.

To move a single project to another instance, use **Export** on the project page and **Import** on the projects list.

## Troubleshooting

**Database connection timeouts while a VPN is on.** Some corporate VPNs route `172.16.0.0/12` or `10.0.0.0/8`, which breaks Docker's port forwarding. The Compose network is pinned to `192.168.237.0/24` to avoid this; change the subnet in `docker-compose.yml` if your VPN routes that range too.
