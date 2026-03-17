#!/bin/bash
set -e

echo "🚀 Building Realtime Team Chat App..."

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

echo "✅ Build finished. Ready to start backend."