# Blind Peering Event Management

React + TypeScript dashboard with Django + Django REST Framework backend for running blind peering dinners. Manage restaurants, captains, and participants, automate table assignments, and export captain handouts.

## Features

- Restaurant and participant CRUD with ShadCN UI
- Workflow tracking (`setup -> captains -> participants -> finalized`)
- Random captain selection that honours availability and status
- Round-robin participant allocation with capacity checks and manual overrides
- Pretix integration for participant sync
- SendGrid email integration for assignment notifications
- Editable email templates (subject/body, with a placeholder cheat-sheet and reset-to-default) and a configurable event name shared across the UI and outgoing emails
- Public, no-login carpool board per table (magic link in the assignment email) so participants can coordinate rides
- CSV/print exports for captain packets
- Activity log for assignments, imports, and administration actions

## Tech Stack

- **Frontend**: React 19, TypeScript, TanStack Router/Query, ShadCN UI, Tailwind CSS
- **Backend**: Django 5, Django REST Framework, PostgreSQL
- **Authentication**: Django Sessions (admin creates user accounts)
- **Deployment**: Docker, Gunicorn, WhiteNoise

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io/) 8+
- Python 3.12+
- Docker and Docker Compose

## Quick Start (Development)

### 1. Start PostgreSQL and Django

```bash
# Start PostgreSQL database
docker compose -f docker-compose.dev.yml up -d db mailpit

# Set up Python environment
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Start Django dev server
python manage.py runserver
```

### 2. Start Frontend

```bash
# In a new terminal, from project root
pnpm install
pnpm dev
```

The dashboard is available at `http://localhost:5173`. The Vite dev server proxies API requests to Django at `http://localhost:8000`.

### Email Testing with Mailpit

For local development, emails are caught by [Mailpit](https://mailpit.axllent.org/) instead of being sent via SendGrid.

```bash
# Start Mailpit along with the database
docker compose -f docker-compose.dev.yml up -d db mailpit
```

Access the Mailpit web UI at `http://localhost:8025/mailpit/` to view all emails sent by the application.

When running Django locally (outside Docker), set the SMTP host in your environment:

```bash
export EMAIL_SMTP_HOST=localhost
export EMAIL_SMTP_PORT=1025
```

### Alternative: Run everything with Docker Compose

`docker-compose.dev.yml` runs the full stack (Postgres, Mailpit, Django
runserver, Vite with hot reload) behind an nginx gateway on one origin:

| Path        | Service                          |
| ----------- | -------------------------------- |
| `/`         | Vite dev server (React app)      |
| `/api/`     | Django API                       |
| `/admin/`   | Django admin                     |
| `/mailpit/` | Mailpit (all emails sent by app) |

```bash
docker compose -f docker-compose.dev.yml up -d --build   # migrations run on start
docker compose -f docker-compose.dev.yml exec django python manage.py createsuperuser
```

The app is at `http://localhost:8000` (set `FRONTEND_BASE_URL=http://localhost:8000`
in `.env` so carpool links in emails match). Code is bind-mounted, so edits and
`git pull` take effect without a rebuild. Host ports can be moved with
`DEV_HOST_PORT`, `DEV_DB_PORT`, `DEV_MAILPIT_UI_PORT` and `DEV_SMTP_PORT`.

### Test Stack on the Dev Server

The same stack can replace the production app on a server behind the shared
Caddy, so peers can test at the public URL without real emails going out.
`docker-compose.dev.remote.yml` attaches the gateway to the proxy network as
`${APP_CONTAINER_NAME}:8000` (e.g. `blindpeering-app:8000`). It reads
`APP_CONTAINER_NAME`, `PROXY_NETWORK` and `FRONTEND_BASE_URL` from `.env`.

```bash
DEV="-f docker-compose.dev.yml -f docker-compose.dev.remote.yml"

docker compose down                    # stop production (frees the container name)
docker compose $DEV up -d --build
docker compose $DEV exec django python manage.py createsuperuser

# back to production
docker compose $DEV down && docker compose up -d
```

The dev stack keeps its own database in `postgresdata-dev/`. It runs with
`DEBUG=True` and Mailpit is public at `/mailpit/`, so only use it with test
data. Set `MAILPIT_UI_AUTH=user:password` in `.env` to put the Mailpit UI
behind basic auth.

## Environment Variables

Create a `.env` file in the project root:

```bash
# Django
DJANGO_SECRET_KEY=your-secret-key-here

# PostgreSQL (for local dev, these match docker-compose.dev.yml)
POSTGRES_HOST=localhost
POSTGRES_DB=bpm
POSTGRES_USER=bpm
POSTGRES_PASSWORD=bpm_dev_password

# SendGrid (optional, for email sending)
SENDGRID_API_KEY=your-sendgrid-api-key
SMTP_SENDER_EMAIL=noreply@denog.de
SMTP_SENDER_NAME=DENOG Event Team
EMAIL_BCC_ADDRESS=sascha@denog.de

# Pretix (optional, for participant sync)
PRETIX_API_TOKEN=your-pretix-token
PRETIX_EVENT=your-event-slug
PRETIX_ORGANIZER=denog
PRETIX_CHECKIN_LIST_ID_LOCAL=123
PRETIX_CHECKIN_LIST_ID_GLOBAL=456

# Carpool board
FRONTEND_BASE_URL=http://localhost:5173
CARPOOL_MESSAGE_RETENTION_DAYS=3
```

## User Management

Users are created by the admin in Django Admin:

1. Go to `http://localhost:8000/admin/`
2. Log in with your superuser credentials
3. Create users under "Users" section

Users log in at `/login` with username and password.

## Scripts

| Command        | Description                         |
| -------------- | ----------------------------------- |
| `pnpm dev`     | Start Vite dev server (HMR enabled) |
| `pnpm build`   | Type-check + build for production   |
| `pnpm preview` | Preview production build            |
| `pnpm lint`    | Run linting via ESLint              |

### Django Management Commands

```bash
cd backend

# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Sync participants from Pretix
python manage.py sync_pretix

# Delete carpool messages past the retention window (no in-repo scheduler --
# run this via external cron, same as sync_pretix)
python manage.py cleanup_expired_carpool_messages

# Rotate every participant's carpool token (invalidates all existing magic
# links). Add --purge-messages when reusing the installation for a new event
# to also drop old messages.
python manage.py rotate_carpool_tokens --purge-messages

# Collect static files (for production)
python manage.py collectstatic
```

## Data Model

| Table                  | Purpose                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `restaurants`          | Event venues. Tracks address, transport info, capacity, and assigned captain.                     |
| `participants`         | Pretix attendees. Includes captain flag, contact preferences, and status enum.                    |
| `assignments`          | Participant-to-restaurant mapping. Unique per participant and includes `assigned_at`.             |
| `event_status`         | Single-row workflow tracker (`setup`, `captains_assigned`, `participants_assigned`, `finalized`). Also holds the event name, date, arrival time, and the editable email template subject/body pairs. |
| `event_activity`       | Append-only audit trail for automation steps and manual adjustments.                              |
| `email_logs`           | Log of sent assignment emails.                                                                    |
| `restaurant_comments`  | Comments on restaurants.                                                                          |
| `participant_comments` | Comments on participants.                                                                         |
| `carpool_messages`     | Table-scoped carpool coordination messages posted by participants via their magic link.           |

## Assignment Workflow

1. **Setup** - Import participants and add restaurants. Required checks:
   - Participant warning if `registered + late_joiner` count exceeds total capacity.
   - Captain warning if fewer active captains than restaurants.
2. **Assign all captains** - Randomises captains across every restaurant.
3. **Assign all participants** - Round-robin placement prioritising least full restaurant.
4. **Manual tweaks** - Reassign or unassign participants via the UI.
5. **Finalize event** - Locks the workflow; all assignment actions become read-only.

## Event Name & Email Templates

The **Event Settings** card on the dashboard sets the event name, date, and arrival time — all three are required before assignment emails can be sent. The **Email Templates** card lets you edit the subject/body of the two outgoing emails and reset either one back to its default:

- **Participant Assignment** — sent to each participant with their restaurant/table details. Placeholders: `event_name`, `event_date`, `arrival_time`, `participant_name`, `restaurant_name`, `restaurant_address`, `reservation_name`, `taxi_time`, `pt_time`, `pt_lines`, `captain_name`, `captain_email`, `captain_phone`, `captain_contact`, `table_guests`, `carpool_link`.
- **Captain Overview** — sent to each table captain with their final guest list. Placeholders: `event_name`, `restaurant_name`, `restaurant_address`, `captain_name`, `captain_email`, `guest_list`.

Templates are rendered with Python's `str.format`, so placeholders must be written as `{event_name}`; an unrecognised `{placeholder}` in a saved template will surface as an error the next time an email is sent from it.

## Carpool Board

Each participant gets a `{carpool_link}` placeholder in their assignment email — a magic link (`/carpool/<token>/`) to a public, no-login page scoped to their own table, where they can post/read short ride-coordination messages ("driving, room for 2" / "let's meet for public transport at X") and delete their own posts.

This is deliberately an **authorization** feature, not an encryption one: the link's token is a dedicated, unguessable per-participant secret (never reused as/derived from any id exposed elsewhere in the app), and the backend scopes every read/write strictly to the token holder's own table — there is nothing for another table or an outside attacker to access. Organizers keep full moderation ability via the "Carpool messages" section in Django Admin.

Link access expires `CARPOOL_MESSAGE_RETENTION_DAYS` (default 3) days after the event date, and access **fails closed** if no event date is set. Each message is stamped at post time with its own immutable `expires_at` (event date + retention) — later edits to the singleton event date never move an existing message's deadline or resurface one. The board hides messages past their `expires_at` even before cleanup runs; the `cleanup_expired_carpool_messages` command then permanently deletes them (data minimization) regardless of the current event date — schedule it externally, same as `sync_pretix`.

The endpoints are throttled **per magic-link token** (`carpool-read`/`carpool-write` scopes) rather than per IP, so participants sharing venue WiFi/NAT don't share a bucket. A coarse `carpool-ip` scope is a flood backstop; it defaults to 8000/hour (~100 concurrently active participants behind one NAT) — set `CARPOOL_IP_RATE_PER_HOUR` higher for a larger shared-WiFi venue. The frontend board polls every 60s (~60 read req/hour per open page) and keeps showing the last good board through transient refetch failures.

**Reusing the installation for a new event:** run `rotate_carpool_tokens --purge-messages`. Participant rows (and their tokens) survive a Pretix re-sync, so rotation is what stops a previously shared/leaked link from working against the new event, and `--purge-messages` clears old messages that immutable expiry would otherwise still surface at a reused restaurant if the new event is configured before the retention window elapses. If events are always separated by more than `CARPOOL_MESSAGE_RETENTION_DAYS`, messages self-expire and this is moot; there is no per-event board object, so honoring that separation (or running the command) is the operator's responsibility.

**Rollout note:** the `{carpool_link}` placeholder was added to the default assignment email template, but editing a template's default text does not retroactively change an already-saved live template (see "Event Name & Email Templates" above) — after upgrading, add `{carpool_link}` to your current assignment email body yourself, or use "Reset to default."

## Exporting Captain Packets

Use the **Export rosters** button on the dashboard or assignments page:

1. Download a CSV with restaurant, captain, and participant data.
2. Open a print-friendly HTML page for PDF generation.

## Production Deployment

The production image is built directly on the host by Docker Compose — no
workstation build, image archive, or SCP step. The container entrypoint runs
Django migrations automatically before gunicorn starts (controlled by
`AUTO_MIGRATE`), so pulling and recreating is a complete deployment.

### Initial Deployment

```bash
# On the production host
git clone YOUR_REPOSITORY_URL bpm
cd bpm

# Create and edit the production configuration before building or starting.
cp .env.example .env
${EDITOR:-vi} .env   # secrets, ALLOWED_HOSTS, FRONTEND_BASE_URL, proxy knobs

docker compose up -d --build

# One-time setup for a new installation.
docker compose exec app python manage.py createsuperuser
```

### Deploying Updates

```bash
./deploy.sh
```

or equivalently by hand — the old container keeps serving while the new image
builds, so downtime is limited to the container swap plus migrations:

```bash
git pull --ff-only
docker compose up -d --build
```

To manage migrations manually instead, set `AUTO_MIGRATE=false` in `.env` and
run `docker compose run --rm app python manage.py migrate` before `up -d`.

**Rollback:** `git checkout <previous-rev> && docker compose up -d --build`.
Down-migrations are never run automatically.

### Reverse Proxy (Caddy)

The app is not meant to be exposed publicly: by default compose publishes it
on `127.0.0.1:8080` only. Production settings trust the proxy's
`X-Forwarded-Proto` header (TLS terminates at the proxy), and
`FRONTEND_BASE_URL` seeds `CSRF_TRUSTED_ORIGINS` — set it to the canonical
public origin and list the public hostname(s) in `ALLOWED_HOSTS`.

The DNS name and port the proxy uses to reach the app are configurable via
`.env`, so an existing Caddy configuration can be matched **without editing
compose files**:

| Caddy upstream          | `.env` values                                            |
| ----------------------- | -------------------------------------------------------- |
| `bpm:8080`              | defaults (alias via `APP_NETWORK_ALIAS=bpm`)             |
| `bpm-app:8080`          | defaults (`APP_CONTAINER_NAME=bpm-app`)                  |
| `blindpeering-app:8000` | `APP_CONTAINER_NAME=blindpeering-app`, `APP_PORT=8000`   |

`APP_PORT` is the port gunicorn binds *inside the container* — this is the
upstream port when proxying over a Docker network. `APP_BIND_ADDR` /
`APP_HOST_PORT` only control the loopback host publishing (for debugging).

**Caddy on the host** — proxy to the loopback publish:

```
reverse_proxy 127.0.0.1:8080
```

**Caddy as a container in another stack** — share a Docker network with this
stack via the opt-in override `docker-compose.proxy.yml`:

```bash
docker network create proxy   # once per host
```

`.env`:

```dotenv
COMPOSE_FILE=docker-compose.yml:docker-compose.proxy.yml
PROXY_NETWORK=proxy
APP_CONTAINER_NAME=bpm-app
APP_PORT=8080
```

Then `docker compose up -d` as usual, and in the Caddyfile:

```
reverse_proxy bpm-app:8080   # ${APP_CONTAINER_NAME}:${APP_PORT}
```

### Health & Monitoring

- `GET /api/health/` — unauthenticated; also used by the compose healthcheck
  on the app container.
- `docker compose ps` shows the app as `healthy`; migrations and startup
  output appear in `docker compose logs app`.

### Scheduled Tasks

`sync_pretix` and `cleanup_expired_carpool_messages` have no in-container
scheduler — run them from the host cron:

```cron
15 4 * * * cd /path/to/bpm && docker compose exec -T app python manage.py cleanup_expired_carpool_messages
```

## API Endpoints

| Resource          | Endpoint                         | Methods            |
| ----------------- | -------------------------------- | ------------------ |
| Participants      | `/api/participants/`             | GET, POST          |
| Participant       | `/api/participants/{id}/`        | GET, PATCH, DELETE |
| Pretix Sync       | `/api/participants/sync_pretix/` | POST               |
| Restaurants       | `/api/restaurants/`              | GET, POST          |
| Restaurant        | `/api/restaurants/{id}/`         | GET, PATCH, DELETE |
| Assignments       | `/api/assignments/`              | GET, POST          |
| Clear Assignments | `/api/assignments/clear_all/`    | DELETE             |
| Event Status      | `/api/event-status/`             | GET, PATCH         |
| Update Event Settings | `/api/event-status/update_state/` | PATCH, PUT     |
| Reset Email Template | `/api/event-status/reset_email_template/` | POST   |
| Activity Log      | `/api/activity/`                 | GET, POST          |
| Email Logs        | `/api/emails/`                   | GET                |
| Send Email        | `/api/emails/send/`              | POST               |
| Carpool Board (public, token-authenticated) | `/api/carpool/<token>/` | GET     |
| Carpool Post Message (public) | `/api/carpool/<token>/messages/` | POST     |
| Carpool Delete Message (public) | `/api/carpool/<token>/messages/<id>/` | DELETE |
| Login             | `/api/auth/login/`               | POST               |
| Logout            | `/api/auth/logout/`              | POST               |
| Session           | `/api/auth/session/`             | GET                |

## Notes

- CSV imports expect headers: `pretix_id, attendee_email, given_name, family_name, attendee_name, is_table_captain, status`
- A significant amount of business logic currently runs in the frontend because the app was initially developed with a serverless-first approach; this will be addressed in subsequent releases.
- Tailwind CSS (v4) with ShadCN components powers the UI; adjust themes via `src/index.css`

## License

MIT — see `LICENSE`.
