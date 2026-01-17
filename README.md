# Neurai Monitor

Neurai Monitor is a robust, self-hosted monitoring solution designed to track the availability and SSL status of network infrastructure. It specifically supports standard websites (HTTP/HTTPS) and ElectrumX servers (SSL/WSS), providing a real-time responsive dashboard with historical uptime visualization.

## Features

-   **Multi-Protocol Support**: Monitors `http://`, `https://`, `ssl://`, and `wss://` endpoints.
-   **Smart Scheduling**: Checks are aligned to 15-minute intervals (00, 15, 30, 45) for consistent data points.
-   **SSL Tracking**: Validates SSL certificates and warns when expiration is within 10 days.
-   **Interactive Dashboard**:
    -   **144-Hour History Grid**: GitHub-style hourly heatmap (4-row grid) with incident-based colors and gray for no data.
    -   **Responsive Design**: Optimized for Desktop and Mobile (with compact filter dropdown on mobile).
    -   **View Modes**: Toggle between "Standard" (spacious) and "Compact" (high-density) views.
    -   **Filtering**: Optional, auto-generated from `##` headings in `backend/domains`. If no headings are present, filters are hidden.
-   **Resilience**: Automated gap-filling logic ensures historical continuity even after downtime.
-   **Retention**: Keeps 7 days of history in the database.

## Technology Stack

### Backend
-   **Runtime**: Node.js
-   **Framework**: Express.js (API)
-   **Database**: PostgreSQL (Persistent history storage)
-   **Key Libraries**: `ssl-checker` (Certificate validation), `pg` (Database client).
-   **Architecture**: Modularized into `db` (Data Layer), `scheduler` (Logic Layer), and `server` (API Layer).

### Frontend
-   **Framework**: Astro (Static Site Generation + Server Side Rendering)
-   **Styling**: TailwindCSS
-   **Logic**: Vanilla JavaScript (Modularized in `dashboard.js` for performance).

### Infrastructure
-   **Containerization**: Docker & Docker Compose

---

## Deployment Instructions

### Prerequisites
-   Docker Engine installed.
-   Docker Compose installed.

### Installation

1.  **Clone or Copy the Project**:
    Ensure you have the full project structure (`backend/`, `frontend/`, `docker-compose.yml`).

2.  **Configure Domains**:
    Edit the `backend/domains` file. Add one domain per line. Optionally group entries with `##` headings to create filter buttons in the UI.
    
    **Example `backend/domains` with filters**:
    ```text
    ## ElectrumX
    wss://electrumx.neurai.org:50022
    ssl://electrum.neurai.org:50002
    ## Websites
    https://neurai.org
    http://explorer.neurai.org
    ```
    **Example `backend/domains` without filters**:
    ```text
    wss://electrumx.neurai.org:50022
    ssl://electrum.neurai.org:50002
    https://neurai.org
    http://explorer.neurai.org
    ```

3.  **Start the Services**:
    Run the following command in the project root:
    ```bash
    docker compose up -d --build
    ```
    This will build the images and start the PostgreSQL database, Backend API, and Frontend dashboard.

### Accessing the Dashboard
Open your browser and navigate to:
**http://localhost:4321**

---

## Operational Guide

### Adding New Domains
1.  Open `backend/domains` on the host machine.
2.  Add the new URLs (and optional `##` headings).
3.  Restart the backend container to reload the list:
    ```bash
    docker compose restart backend
    ```
    *Note: The dashboard only shows domains listed in `backend/domains`, even if older entries exist in the database. New domains appear after the next scheduled check (within 15 minutes).*

### Backup & Restore

**Backup Database**:
To create a backup of the monitoring history:
```bash
docker compose exec db pg_dump -U postgres domain_monitor > backup_monitor.sql
```

**Restore Database**:
To restore from a backup file (replace `backup_monitor.sql` with your file):
```bash
cat backup_monitor.sql | docker compose exec -T db psql -U postgres domain_monitor
```

### Viewing Logs
To check the logs for debugging or verification:
```bash
# View all logs
docker compose logs -f

# View specific service logs
docker compose logs -f syncer
docker compose logs -f backend
docker compose logs -f frontend
```
## Licence
MIT (2026)