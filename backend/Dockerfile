FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/migrate ./cmd/migrate

FROM alpine:3.21 AS api
RUN addgroup -S app && adduser -S -G app app
COPY --from=build /out/api /api
USER app
EXPOSE 8080
ENTRYPOINT ["/api"]

FROM alpine:3.21 AS worker
RUN addgroup -S app && adduser -S -G app app
COPY --from=build /out/worker /worker
USER app
ENTRYPOINT ["/worker"]

FROM alpine:3.21 AS migrate
RUN addgroup -S app && adduser -S -G app app
COPY --from=build /out/migrate /migrate
USER app
ENTRYPOINT ["/migrate"]
