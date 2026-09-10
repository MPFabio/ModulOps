FROM golang:1.26-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates && update-ca-certificates

COPY go.mod go.sum* ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o pipeline-service ./main.go

FROM gcr.io/distroless/base-debian12

WORKDIR /app

COPY --from=builder /app/pipeline-service /app/pipeline-service

EXPOSE 8084

ENV PIPELINE_SERVICE_PORT=8084

ENTRYPOINT ["/app/pipeline-service"]
