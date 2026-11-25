.DEFAULT:
	echo "No rule for target '$@'. Skipped."

install: server-install ui-install docs-install
server-install:
	cd server && uv sync
ui-install:
	cd ui && yarn install

init:
	uv sync --directory server
	uv run --directory server pre-commit install

check-types:
	cd server && uv run basedpyright --level error

test:
	cd server && uv run -m pytest tests/ -s

fixtures:
	cd server &&  POSTGRES_HOST="localhost" uv run python src/fixtures/generate_entities.py

format:
	cd server && uv run ruff format && uv run ruff check --fix

# --- Docs (Blume) ---
docs-install:
	yarn install

docs-dev: docs-install
	yarn dev

docs-build: docs-install
	yarn build

docs-validate:
	yarn blume validate --isolated
