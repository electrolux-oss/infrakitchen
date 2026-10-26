#!/usr/bin/env sh
cd ui
echo "Checking typescript for frontend"
yarn install --immutable && yarn format:check && yarn lint && yarn tsc -p tsconfig.app.json --noEmit
