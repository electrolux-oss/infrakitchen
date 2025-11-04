#!/bin/sh
set -ex
cd server

uv run ruff check --diff
