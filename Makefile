.PHONY: help backend backend-build backend-test frontend-install player admin build clean

help:
	@echo "Targets:"
	@echo "  backend            Run the Go API server (localhost:8080)"
	@echo "  backend-build      Build the server binary into backend/bin/"
	@echo "  backend-test       Run Go unit tests"
	@echo "  frontend-install   Install frontend workspace deps"
	@echo "  player             Run the player app (localhost:5173)"
	@echo "  admin              Run the admin app (localhost:5174)"
	@echo "  build              Build backend binary + both frontends"

backend:
	cd backend && go run ./cmd/server

backend-build:
	cd backend && go build -o bin/server ./cmd/server

backend-test:
	cd backend && go test ./...

frontend-install:
	cd frontend && npm install

player:
	cd frontend && npm run dev -w apps/player

admin:
	cd frontend && npm run dev -w apps/admin

build: backend-build
	cd frontend && npm run build -w apps/player && npm run build -w apps/admin

clean:
	rm -rf backend/bin backend/*.db frontend/node_modules frontend/apps/*/dist
