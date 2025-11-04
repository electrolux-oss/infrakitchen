#!/bin/sh
cd server

uv run ruff check --fix
uv run ruff format
