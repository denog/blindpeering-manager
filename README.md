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

Access the Mailpit web UI at `http://localhost:8025` to view all emails sent by the application.

When running Django locally (outside Docker), set the SMTP host in your environment:

```bash
export EMAIL_SMTP_HOST=localhost
export EMAIL_SMTP_PORT=1025
```

### Alternative: Run everything with Docker Compose

```bash
# Start PostgreSQL, Django, and Mailpit
docker compose -f docker-compose.dev.yml up -d

# Run migrations inside the container
docker compose -f docker-compose.dev.yml exec django python manage.py migrate

# Create admin user
docker compose -f docker-compose.dev.yml exec django python manage.py createsuperuser

# Start frontend
pnpm install
pnpm dev
```

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

- **Participant Assignment** — sent to each participant with their restaurant/table details. Placeholders: `event_name`, `event_date`, `arrival_time`, `participant_name`, `restaurant_name`, `restaurant_address`, `reservation_name`, `taxi_time`, `pt_time`, `pt_lines`, `captain_name`, `captain_email`, `captain_phone`, `captain_contact`, `table_guests`.
- **Captain Overview** — sent to each table captain with their final guest list. Placeholders: `event_name`, `restaurant_name`, `restaurant_address`, `captain_name`, `captain_email`, `guest_list`.

Templates are rendered with Python's `str.format`, so placeholders must be written as `{event_name}`; an unrecognised `{placeholder}` in a saved template will surface as an error the next time an email is sent from it.

## Exporting Captain Packets

Use the **Export rosters** button on the dashboard or assignments page:

1. Download a CSV with restaurant, captain, and participant data.
2. Open a print-friendly HTML page for PDF generation.

## Production Deployment

### Build Docker Image

```bash
export DOCKER_BUILDKIT=1
docker buildx build --platform linux/amd64 --secret id=env_file,src=.env -t bpm:latest --load .
docker save bpm:latest | gzip > bpm.tar.gz
scp bpm.tar.gz root@your-server:/path/to/bpm/
```

### On Server

```bash
# Load the image
docker load < bpm.tar.gz

# Create .env file with production values
cat > .env << EOF
DJANGO_SECRET_KEY=your-production-secret-key
POSTGRES_DB=bpm_prod
POSTGRES_USER=bpm_prod
POSTGRES_PASSWORD=your-secure-password
ALLOWED_HOSTS=your-domain.com
SENDGRID_API_KEY=your-api-key
# ... other env vars
EOF

# Start services
docker compose up -d

# Run migrations
docker compose exec app python manage.py migrate

# Create admin user
docker compose exec app python manage.py createsuperuser
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
| Login             | `/api/auth/login/`               | POST               |
| Logout            | `/api/auth/logout/`              | POST               |
| Session           | `/api/auth/session/`             | GET                |

## Notes

- CSV imports expect headers: `pretix_id, attendee_email, given_name, family_name, attendee_name, is_table_captain, status`
- A significant amount of business logic currently runs in the frontend because the app was initially developed with a serverless-first approach; this will be addressed in subsequent releases.
- Tailwind CSS (v4) with ShadCN components powers the UI; adjust themes via `src/index.css`

## License

MIT — see `LICENSE`.
