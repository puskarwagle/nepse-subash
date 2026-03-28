#!/bin/bash

# NEPSE EMA Scanner - Task Runner

function show_help {
    echo "Usage: ./run.sh [command] [args]"
    echo ""
    echo "Commands:"
    echo "  install            Install all Python and Node.js dependencies"
    echo "  sync               Sync historical data from external repository"
    echo "  run                Start both backend and frontend servers simultaneously"
    echo "  scrape [date]      Run the scraper (date format: MM/DD/YYYY, optional)"
    echo "  process            Convert CSV data to JS batches for static frontend"
    echo "  backend            Start the FastAPI backend server"
    echo "  frontend           Start the SvelteKit frontend (dev mode)"
    echo "  help               Show this help message"
}

case "$1" in
    scrape)
        python3 src/scraper/scrape_nepse.py "$2"
        ;;
    process)
        python3 scripts/convert-to-json.py
        ;;
    sync)
        python3 scripts/sync-data.py
        ;;
    install)
        echo "Installing Python dependencies..."
        pip install -r requirements.txt
        echo "Installing SvelteKit dependencies..."
        cd src/web-svelte && npm install
        ;;
    backend)
        export PYTHONPATH=$PYTHONPATH:.
        uvicorn src.backend.backend:app --reload
        ;;
    frontend)
        cd src/web-svelte && npm run dev
        ;;
    run)
        echo "Starting NEPSE EMA Scanner..."
        
        # Function to kill background processes on exit
        cleanup() {
            echo ""
            echo "Shutting down servers..."
            kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
            exit
        }

        # Trap Ctrl+C
        trap cleanup SIGINT SIGTERM

        # Start backend in background from root with PYTHONPATH set
        export PYTHONPATH=$PYTHONPATH:.
        uvicorn src.backend.backend:app --port 8000 &
        BACKEND_PID=$!
        
        # Start frontend in background
        (cd src/web-svelte && npm run dev -- --port 5173) &
        FRONTEND_PID=$!
        
        echo "------------------------------------------------"
        echo "Backend is running on http://localhost:8000"
        echo "Frontend is running on http://localhost:5173"
        echo "------------------------------------------------"
        echo "Press Ctrl+C to stop both."
        
        # Wait for both background processes
        wait $BACKEND_PID $FRONTEND_PID
        ;;
    *)
        show_help
        ;;
esac
