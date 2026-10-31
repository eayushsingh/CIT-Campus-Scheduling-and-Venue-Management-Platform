.PHONY: help setup dev dev-backend dev-frontend test validate export clean

help:
	@echo "Chilika Institute of Technology (CIT) Scheduling Platform"
	@echo "Available commands:"
	@echo "  make setup        - Install backend (venv + pip) and frontend (npm) dependencies"
	@echo "  make dev          - Run both backend and frontend concurrently"
	@echo "  make dev-backend  - Run FastAPI backend on port 8000"
	@echo "  make dev-frontend - Run Vite frontend on port 5173"
	@echo "  make test         - Run full pytest test suite (60+ tests)"
	@echo "  make validate     - Run official validator.py on schedule.json and schedule_after.json"
	@echo "  make export       - Run solver CLI and generate schedule.json & schedule_after.json"
	@echo "  make clean        - Remove caches, pyc, build artifacts"

setup:
	python3 -m venv venv
	./venv/bin/pip install --upgrade pip
	./venv/bin/pip install -r backend/requirements.txt
	cd frontend && npm install

dev-backend:
	./venv/bin/uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting backend and frontend..."
	@make -j 2 dev-backend dev-frontend

test:
	./venv/bin/pytest -v

validate:
	@echo "=== Validating Baseline Schedule ==="
	./venv/bin/python data/validator.py --data data/cit_public.json --schedule exports/schedule.json
	@echo ""
	@echo "=== Validating Disruption Reschedule ==="
	./venv/bin/python data/validator.py --data data/cit_public.json --schedule exports/schedule_after.json --disruption data/sample_disruption.json --baseline exports/schedule.json

export:
	./venv/bin/python -m backend.app.cli export
	./venv/bin/python -m backend.app.cli reschedule

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	rm -rf .pytest_cache
	rm -rf frontend/dist
