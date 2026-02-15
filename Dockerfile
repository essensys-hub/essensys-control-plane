# ============================================
# Stage 1: Build React UI
# ============================================
FROM node:20-alpine AS ui-builder

WORKDIR /ui
COPY ui/package*.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# ============================================
# Stage 2: Build Go binary
# ============================================
FROM golang:1.24-alpine AS go-builder

RUN apk add --no-cache gcc musl-dev

WORKDIR /app

# Copy go.mod and go.sum first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY cmd/ ./cmd/
COPY internal/ ./internal/

# Copy built UI into ui/dist for embed
COPY ui/embed.go ./ui/embed.go
COPY --from=ui-builder /ui/dist ./ui/dist

# Build with CGO enabled (for SQLite) and ldflags
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown

RUN CGO_ENABLED=1 GOOS=linux go build \
    -ldflags "-X main.version=${VERSION} -X main.commit=${COMMIT} -X main.buildTime=${BUILD_TIME}" \
    -o /controlplane ./cmd/controlplane/

# ============================================
# Stage 3: Runtime (shared base image)
# ============================================
FROM essensyshub/essensys-base:raspberry.2026.02

COPY --from=go-builder /controlplane /usr/local/bin/controlplane

EXPOSE 9100

VOLUME ["/data"]

ENTRYPOINT ["controlplane"]
CMD ["-config", "/etc/controlplane/config.yaml"]
