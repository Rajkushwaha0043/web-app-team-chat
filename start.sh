#!/bin/bash
set -e

echo "🚀 Starting Realtime Team Chat App..."

# -------------------------------
# 1️⃣ Install backend dependencies
# -------------------------------
cd realtime-team-chat-backend
echo "📦 Installing backend dependencies..."
npm install

# -------------------------------
# 2️⃣ Install and build frontend
# -------------------------------
cd ../teamchat-frontend
echo "📦 Installing frontend dependencies..."
npm install

echo "🔨 Building frontend..."
npm run build

# -------------------------------
# 3️⃣ Move frontend build into backend
# -------------------------------
echo "📦 Moving frontend build into backend..."
rm -rf ../realtime-team-chat-backend/public || true
cp -r build ../realtime-team-chat-backend/public

# -------------------------------
# 4️⃣ Start backend (serves frontend automatically)
# -------------------------------
cd ../realtime-team-chat-backend
BACKEND_PORT=${PORT:-3000}
export PORT=$BACKEND_PORT

echo "⚡ Starting backend on port $BACKEND_PORT..."
node src/server.js