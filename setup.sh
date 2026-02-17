#!/bin/bash

# PetMan Application Setup Script
# This script helps you set up the development environment

echo "🐾 PetMan Application Setup"
echo "=========================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Check if .env.local exists
if [ -f .env.local ]; then
    echo "⚠️  .env.local already exists. Skipping environment setup."
else
    echo "📝 Creating .env.local file..."
    echo ""
    echo "Please enter your Supabase credentials:"
    echo "(You can find these in your Supabase project dashboard under Settings > API)"
    echo ""
    
    read -p "Supabase Project URL: " SUPABASE_URL
    read -p "Supabase Anon Key: " SUPABASE_KEY
    
    cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_KEY
EOF
    
    echo ""
    echo "✅ .env.local file created!"
fi

echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Dependencies installed successfully!"
    echo ""
    echo "🚀 Setup complete! You can now run:"
    echo "   npm run dev"
    echo ""
    echo "Then visit http://localhost:3000 in your browser."
    echo ""
    echo "📚 Next steps:"
    echo "   1. Make sure you've run the SQL schema in Supabase (see DEPLOYMENT.md)"
    echo "   2. Start the development server: npm run dev"
    echo "   3. Deploy to Vercel when ready: vercel"
else
    echo ""
    echo "❌ Failed to install dependencies. Please check the errors above."
    exit 1
fi
