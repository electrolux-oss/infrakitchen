# Quick Start

## 🚀 Try InfraKitchen Locally

For local development, you can use one of the following options:

- ❄️ **[Nix Flake](./development/nix-flake.md)** (recommended)
- 🐳 **[Docker](./development/docker.md)**
- 🦭 **[Podman](./development/podman.md)**

InfraKitchen has a backend and frontend codebase. This repo (`electrolux-oss/infrakitchen` on [GitHub](https://github.com/electrolux-oss/infrakitchen)) contains both parts:

- `server/` contains the backend (Python/FastAPI)
- `ui/` contains the frontend (React/TypeScript)

The following services are automatically set up for you:

- [RabbitMQ Broker](https://www.rabbitmq.com/) for driving the events
- [PostgreSQL](https://www.postgresql.org/) for storing the data

InfraKitchen will be available at `http://localhost:7777` and you can log in with Guest user.

**New to InfraKitchen?** Start with [Core Concepts](../core-concepts/overview.md) to understand the key terminology.

---

## ⚙️ Default Settings

Encryption keys will be automatically generated on first run in the `server/.env_local` file.

All data will be stored in the `ik_data/` folder. You can delete this folder to start the project from scratch.

---

## 🛠️ Add fake data

To populate InfraKitchen with fake data for testing purposes, you can run the following command:

```bash
make fixtures
```

---

## 🔑 Generate Secret Keys

You can generate secret keys for backend by running the following commands:

```bash
python server/generate_encryption_key.py
```
