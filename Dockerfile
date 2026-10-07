# ==============================================================================
# SecuAI Multi-Runtime Container (Node.js 20-slim + Python 3 + isitsecure)
# Architecture: Single Docker image hosting Express API + Postgres Polling Worker
# Zero Redis / BullMQ dependency — Postgres polling with RLS
# Non-root user execution with automated health check
# ==============================================================================

FROM node:20-slim

# Install system dependencies: Python 3, pip, venv, git, curl, and certificates
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set up Python virtual environment
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Set up working directory
WORKDIR /app

# Copy engine sources and install isitsecure (pinned version 0.32.2)
COPY engine/isitsecure-src ./engine/isitsecure-src
RUN pip install --no-cache-dir ./engine/isitsecure-src || \
    pip install --no-cache-dir isitsecure==0.32.2 || \
    pip install --no-cache-dir git+https://github.com/jaurakunal/isitsecure.git@v0.32.2

# Copy package manifests first for caching
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY engine/adapter/package*.json ./engine/adapter/
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/

# Install Node dependencies
RUN npm ci --include=dev

# Copy entire monorepo source code
COPY . .

# Build all monorepo packages and apps
RUN npm run build

# Prepare workspace directory and set permissions for non-root user (node)
RUN mkdir -p /tmp/secuai-workspaces && \
    chown -R node:node /tmp/secuai-workspaces /app /opt/venv

# Set environment defaults
ENV NODE_ENV=production
ENV PORT=4000
ENV ISITSECURE_BIN=/opt/venv/bin/isitsecure

# Expose API port
EXPOSE 4000

# Automated container health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/health || exit 1

# Switch to non-root user
USER node

# Start API and worker processes via supervisor script
CMD ["node", "scripts/supervise.js"]
