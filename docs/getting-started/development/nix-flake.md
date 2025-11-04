# Nix Flake Setup

Set up InfraKitchen using [Nix](https://nixos.org/download.html) for a reproducible development environment.

---

## 🚀 Quick Start

If you don't have Nix installed:

```bash
# Official installer (recommended)
curl -L https://nixos.org/nix/install | sh -s -- --daemon
```

Clone the repository and run:

```bash
nix develop
```

Access at [http://localhost:7777](http://localhost:7777) and log in with **Guest** user.

---

## ⚙️ Enable Experimental Features

If you see `error: experimental Nix feature 'nix-command' is disabled`:

Add to `/etc/nix/nix.conf` (or `~/.config/nix/nix.conf` on macOS):

```
experimental-features = nix-command flakes
```

Then restart the Nix daemon or run with flag:

```bash
nix --extra-experimental-features 'nix-command flakes' develop
```

---

## 📦 What's Included

The Nix shell automatically sets up:

- Python 3.14 with backend dependencies
- Node.js with frontend dependencies
- PostgreSQL, RabbitMQ
- Development tools (ruff, pyright, prettier, eslint)

All isolated from your system.

---

## 🛠️ Common Commands

To exit the Nix shell, type `exit` or press <kbd>Ctrl</kbd>+<kbd>D</kbd>.

---

## ➡️ Next Steps

- 🛠️ [Platform Engineer Guide](../../guides/platform-engineer-guide.md) — Step-by-step setup for platform teams.
- 👩‍💻 [Developer Guide](../../guides/developer-guide.md) — How to provision resources as a developer.
- 🧩 [Core Concepts](../../core-concepts/overview.md) — Learn about InfraKitchen's main building blocks.
