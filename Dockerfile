# Multi-Stage Build: Single Lightweight Container for EasyEA

# --- Stage 1: Build Frontend ---
FROM node:22-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Python Backend & Static Server ---
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libxml2-dev \
    libxslt-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/app ./app

# Copy plugins
COPY plugins ./plugins

# Copy built frontend assets from stage 1 into the frontend dist location
COPY --from=frontend-builder /build/dist /frontend/dist

# Create non-privileged system group and user (SCA-CONTAINER-ROOT / CWE-250)
RUN groupadd -g 1001 easyea \
    && useradd -u 1001 -g easyea -d /app -s /usr/sbin/nologin easyea \
    && chown -R easyea:easyea /app /frontend

# Expose port (Cloud Run, Railway, Render, etc. pass PORT env var)
ENV PORT=8000
EXPOSE 8000

# Run container as non-root user
USER easyea

# Start FastAPI with Uvicorn
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
