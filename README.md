# Neurai Monitor

Neurai Monitor is a robust, self-hosted monitoring solution designed to track the availability and SSL status of network infrastructure. It specifically supports standard websites (HTTP/HTTPS) and ElectrumX servers (SSL/WSS), providing a real-time responsive dashboard with historical uptime visualization.

<img width="1743" height="1190" alt="image" src="https://github.com/user-attachments/assets/248c653a-f96d-4f51-9385-02cf9d0a18d0" />


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
-   **Framework**: Astro (Static Site Generation)
-   **Styling**: TailwindCSS
-   **Logic**: Vanilla JavaScript (Modularized in `dashboard.js` for performance).
-   **Serving**: The site is built to static files at image build time and served by nginx, which also proxies `/api` to the backend over the internal Docker network.

### Infrastructure
-   **Containerization**: Docker & Docker Compose
-   **Web Server**: nginx (static assets + API reverse proxy)

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
The frontend is published on the loopback interface only (`127.0.0.1:4321`), so it is **not reachable from outside the host**. From the host machine itself:

**http://127.0.0.1:4321**

### Exposing it publicly (reverse proxy)
To serve the dashboard on a public domain, put a reverse proxy (nginx, Caddy, Traefik...) on the host and point it at the loopback port. Minimal nginx example:

```nginx
server {
    listen 80;
    server_name monitor.example.org;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Handle TLS at this layer (e.g. with certbot). The `/api` path needs no special rule: it is proxied to the backend by the container's own nginx.

> **Note**: binding to `127.0.0.1` matters because Docker inserts its own iptables rules ahead of UFW, so a plain `4321:80` mapping would be publicly reachable even with a restrictive host firewall.

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

### Updating the Frontend
The frontend is compiled into its image, so changes to `frontend/` require a rebuild (a restart alone is not enough):
```bash
docker compose up -d --build frontend
```
*The backend is bind-mounted from the host, so it only needs `docker compose restart backend`.*

### Local Development
To run the Astro dev server against a running stack:
```bash
cd frontend && npm install && npm run dev
```
It serves on `http://localhost:4321` and proxies `/api` to `localhost:3344`, so the backend port must be reachable on the host (add a temporary `ports: ["127.0.0.1:3344:3344"]` to the `backend` service). Never expose the dev server publicly: it can serve arbitrary files from the container.

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
docker compose logs -f backend
docker compose logs -f frontend
```
## Licence
MIT (2026)
