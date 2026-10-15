#!/usr/bin/env sh
cd ui
yarn install --immutable && yarn format && yarn lint && yarn tsc --noEmit
