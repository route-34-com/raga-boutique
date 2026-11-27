#!/usr/bin/env bash
# Vercel build: the frontend, the demo catalogue photos, and the page shell the API fills in for each page.
set -euo pipefail
npm --prefix frontend run build
mkdir -p frontend/dist/uploads/products
cp backend/scripts/seed_images/*.jpg frontend/dist/uploads/products/
# Without index.html every page address reaches the API, which serves it from this shell.
mv frontend/dist/index.html frontend/dist/shell.html
mkdir -p backend/app/web
cp frontend/dist/shell.html backend/app/web/shell.html
