#!/bin/sh
set -ex
cd server
uv run basedpyright --level error
