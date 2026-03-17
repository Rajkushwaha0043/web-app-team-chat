#!/bin/bash

# Exit on any error
set -e

echo "🚀 Starting Realtime Team Chat App..."

# -------------------------------
# 1️⃣ Start Backend
# -------------------------------
echo "📦 Installing backend dependencies..."
cd realtime-team-chat-backend
npm install

echo "⚡ Starting backend..."
# Run backend in the background
node src/server.js &

BACKEND_PID=$!
echo "✅ Backend running with PID $BACKEND_PID"

# -------------------------------
# 2️⃣ Build & Serve Frontend
# -------------------------------
echo "📦 Installing frontend dependencies..."
cd ../teamchat-frontend
npm install

echo "🔨 Building frontend..."
npm run build

echo "🌐 Serving frontend statically..."
# Use npx to avoid PATH issues on Windows/Linux
npx serve -s build -l 3000 &

FRONTEND_PID=$!
echo "✅ Frontend running with PID $FRONTEND_PID at http://localhost:3000"

# -------------------------------
# 3️⃣ Wait for processes
# -------------------------------
wait $BACKEND_PID $FRONTEND_PID