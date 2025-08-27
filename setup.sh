#!/bin/bash

echo "🚀 Setting up MCP Chat Client..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

echo "✅ Node.js $(node --version) found"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create environment file if it doesn't exist
if [ ! -f .env.local ]; then
    echo "⚙️ Creating environment file..."
    cp .env.example .env.local
    echo "📝 Please edit .env.local with your actual credentials"
    echo "   - Google OAuth: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET"
    echo "   - Database: DATABASE_URL"
    echo "   - Miro: MIRO_ACCESS_TOKEN"
    echo "   - Anthropic: ANTHROPIC_API_KEY"
fi

# Check if PostgreSQL is available
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL found"
    echo "📊 To create database, run: createdb mcp_chat"
else
    echo "⚠️ PostgreSQL not found. Please install PostgreSQL first."
    echo "   On macOS: brew install postgresql"
    echo "   On Ubuntu: sudo apt install postgresql postgresql-contrib"
fi

# Build the project
echo "🔨 Building project..."
npm run build

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your credentials"
echo "2. Create PostgreSQL database: createdb mcp_chat"
echo "3. Run database migrations: npm run db:migrate"
echo "4. Start MCP service: node services/miro-http-service.js"
echo "5. Start the app: npm run dev"
echo ""
echo "Visit http://localhost:3000 when ready!"