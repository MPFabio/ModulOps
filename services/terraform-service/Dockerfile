FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates && update-ca-certificates

# Étape 1 : copier go.mod et go.sum (si présent)
COPY go.mod go.sum* ./

# Étape 2 : télécharger toutes les dépendances
RUN go mod download

# Étape 3 : copier le code source
#
# Pas de `go mod tidy` ici : il résout aussi les dépendances de test de toutes
# les dépendances transitives (des paquets que ce service n'utilise pas), ce
# qui allongeait le build de plusieurs minutes et le rendait tributaire du
# réseau. Il réécrivait surtout go.mod et go.sum au moment du build, annulant
# la reproductibilité que ces fichiers servent précisément à garantir. Ils sont
# versionnés : le build doit s'y conformer, pas les modifier.
COPY . .

# Étape 4 : builder le binaire
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o terraform-service ./main.go

# Étape 5 : télécharger le binaire OpenTofu (drift "fine")
ARG TOFU_VERSION=1.8.4
RUN apk add --no-cache curl unzip && \
    curl -fsSL -o /tmp/tofu.zip "https://github.com/opentofu/opentofu/releases/download/v${TOFU_VERSION}/tofu_${TOFU_VERSION}_linux_amd64.zip" && \
    unzip -o /tmp/tofu.zip -d /tmp/tofu && \
    chmod +x /tmp/tofu/tofu

FROM gcr.io/distroless/base-debian12

WORKDIR /app

COPY --from=builder /app/terraform-service /app/terraform-service
COPY --from=builder /tmp/tofu/tofu /usr/local/bin/tofu

EXPOSE 8082

ENV TERRAFORM_SERVICE_PORT=8082
ENV TOFU_PATH=/usr/local/bin/tofu

ENTRYPOINT ["/app/terraform-service"]
