# Podman Setup

Set up InfraKitchen using [Podman](https://podman.io/getting-started/installation) for local development.

---

## 🚀 Quick Start

1. Make sure you have Podman installed on your machine. You can download it from [Podman's official website](https://podman.io/getting-started/installation). Optionally, you may need to install `podman-compose` as well. Check the [podman-compose repository](https://github.com/containers/podman-compose) for installation instructions.
2. Clone the project repository to your local machine using Git.
3. From root directory of the project, run the following command to copy the Docker Compose file and start the development environment:

```bash
cp docs/examples/docker/docker-compose.yml ./docker-compose.yml
podman compose up -d
```

Access at [http://localhost:7777](http://localhost:7777) and log in with **Guest** user.

!!! note "Using podman-compose"
    If you have [podman-compose](https://github.com/containers/podman-compose) installed, use `podman-compose` instead of `podman compose`.

---

## 🛠️ Common Commands

```bash
podman compose logs -f    # View logs
podman compose restart    # Restart services
podman compose down       # Stop all services
podman compose up -d      # Start services
```

---

## 🐛 Troubleshooting

**Networking issues between containers:**

You may encounter issues related to networking between containers when using Podman. If you face such issues try to stop and restart the containers:

```bash
podman compose down && podman compose up -d
```

---

## ➡️ Next Steps

- 🛠️ [Platform Engineer Guide](../../guides/platform-engineer-guide.md) — Step-by-step setup for platform teams.
- 👩‍💻 [Developer Guide](../../guides/developer-guide.md) — How to provision resources as a developer.
- 🧩 [Core Concepts](../../core-concepts/overview.md) — Learn about InfraKitchen's main building blocks.
