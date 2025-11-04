# Docker Setup

Set up InfraKitchen using [Docker](https://www.docker.com/get-started) for local development.

---

## 🚀 Quick Start

1. Make sure you have Docker installed on your machine. You can download it from [Docker's official website](https://www.docker.com/get-started).

2. Clone the project repository to your local machine using Git.

3. From the root directory of the project, run the following command to copy Docker Compose file and start the development environment:

```bash
cp docs/examples/docker/docker-compose.yml ./docker-compose.yml
docker compose up -d
```

Access at [http://localhost:7777](http://localhost:7777) and log in with **Guest** user.

---

## 🛠️ Common Commands

```bash
docker compose logs -f    # View logs
docker compose restart    # Restart services
docker compose down       # Stop all services
docker compose up -d      # Start services
```

---

## ➡️ Next Steps

- 🛠️ [Platform Engineer Guide](../../guides/platform-engineer-guide.md) — Step-by-step setup for platform teams.
- 👩‍💻 [Developer Guide](../../guides/developer-guide.md) — How to provision resources as a developer.
- 🧩 [Core Concepts](../../core-concepts/overview.md) — Learn about InfraKitchen's main building blocks.
