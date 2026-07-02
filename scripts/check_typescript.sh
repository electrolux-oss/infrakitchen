#!/usr/bin/env sh
cd ui
echo "Checking typescript for frontend app"
yarn install --immutable && yarn format-lib:check &&
  yarn format:check && yarn lint && yarn tsc --noEmit && yarn lint-lib

echo "Checking typescript for frontend-lib"
cd frontend-lib
yarn tsc --emitDeclarationOnly
