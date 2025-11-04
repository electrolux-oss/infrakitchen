#!/bin/sh
cd server

uv run pytest tests/ -s -W ignore::DeprecationWarning
