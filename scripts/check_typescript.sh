#!/usr/bin/env sh
cd ui
echo "Checking typescript for frontend app"
yarn install --immutable && yarn format:check && yarn lint &&
  yarn tsc --noEmit && yarn build
