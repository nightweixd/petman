# Deployment Guide

This guide walks you through deploying the PetMan application to Vercel with Supabase.

## Step 1: Set Up Supabase (5 minutes)

### Create a Supabase Project

1. Go to https://supabase.com and sign in or create an account
2. Click "New Project"
3. Fill in the details:
   - **Name**: petman (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Select closest to your users
   - **Pricing Plan**: Free tier is fine for getting started
4. Click "Create new project" and wait 2-3 minutes for setup

### Set Up the Database

1. Once ready, click on the SQL Editor icon in the left sidebar
2. Click "New Query"
3. Open the `supabase-schema.sql` file from this project
4. Copy ALL the SQL code and paste it into the Supabase SQL editor
5. Click "Run" or press Cmd/Ctrl + Enter
6. You should see "Success. No rows returned" - this is correct!

### Get Your API Credentials

1. Click on the Settings icon (⚙️) in the left sidebar
2. Go to "API" section
3. Copy these two values (you'll need them later):
   - **Project URL** (looks like: https://xxxxx.supabase.co)
   - **anon/public key** (long string starting with "eyJ...")

## Step 2: Prepare Your Code (2 minutes)

### Option A: Using Git

1. Initialize a Git repository (if you haven't already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. Push to GitHub, GitLab, or Bitbucket:
   ```bash
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

### Option B: Upload Directly to Vercel

Skip this step if using Git. You can upload the folder directly through Vercel's dashboard.

## Step 3: Deploy to Vercel (5 minutes)

### Via Vercel Dashboard (Easiest)

1. Go to https://vercel.com and sign in (GitHub sign-in recommended)
2. Click "Add New..." → "Project"
3. Import your repository:
   - If using Git: Select your repository from the list
   - If uploading: Drag and drop the `petman-app` folder

4. Configure the project:
   - **Framework Preset**: Next.js (should auto-detect)
   - **Root Directory**: ./ (leave as default)
   - **Build Command**: `npm run build` (should auto-fill)
   - **Output Directory**: `.next` (should auto-fill)

5. Add Environment Variables (IMPORTANT!):
   Click "Environment Variables" and add:
   
   **Variable 1:**
   - Name: `NEXT_PUBLIC_SUPABASE_URL`
   - Value: Your Supabase Project URL from Step 1

   **Variable 2:**
   - Name: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Value: Your Supabase anon key from Step 1

6. Click "Deploy"

7. Wait 2-3 minutes for the build to complete

8. Your app is live! 🎉
   - Vercel will show you the URL (e.g., `https://petman-app.vercel.app`)
   - Click "Visit" to see your app

### Via Vercel CLI (Alternative)

If you prefer the command line:

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Navigate to your project:
   ```bash
   cd petman-app
   ```

3. Login to Vercel:
   ```bash
   vercel login
   ```

4. Deploy:
   ```bash
   vercel
   ```

5. Follow the prompts:
   - Set up and deploy? **Y**
   - Which scope? Select your account
   - Link to existing project? **N**
   - Project name? **petman-app** (or your choice)
   - In which directory is your code? **./** (press Enter)
   - Want to override settings? **N**

6. Add environment variables:
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   ```
   Paste your Supabase URL when prompted
   
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```
   Paste your Supabase anon key when prompted

7. Redeploy to pick up environment variables:
   ```bash
   vercel --prod
   ```

## Step 4: Verify Deployment (2 minutes)

1. Visit your deployed URL
2. You should see the PetMan homepage with the customer list
3. Click on a pet (e.g., "Bailey") to view details
4. Try clicking "Edit" and updating some information
5. Click "Save" - the changes should persist

### Troubleshooting

**If you see "Error: No customers found" or database errors:**
1. Go back to Supabase and verify the SQL script ran successfully
2. Check that your environment variables in Vercel are correct
3. Redeploy in Vercel to pick up any changes

**If the page is blank or shows errors:**
1. Check the browser console (F12) for errors
2. Verify your Supabase project is active and not paused
3. Check that you copied the correct API credentials

## Step 5: Customize Your Domain (Optional)

### Add a Custom Domain

1. In Vercel dashboard, go to your project
2. Click "Settings" → "Domains"
3. Add your custom domain
4. Follow Vercel's instructions to update your DNS records
5. Wait for DNS propagation (usually 5-30 minutes)

## What's Next?

### Add More Customers

You can add more customers and pets directly through Supabase:

1. Go to your Supabase project
2. Click "Table Editor" in the sidebar
3. Select "customers" or "pets" table
4. Click "Insert row" to add new records

### Enable Authentication (Recommended for Production)

The current setup allows public access. For production, add authentication:

1. In Supabase, go to Authentication → Settings
2. Enable email authentication or social providers
3. Update the RLS policies to check for authenticated users
4. Add login/signup pages to your Next.js app

### Monitor Your App

1. Vercel provides analytics and logs in the dashboard
2. Supabase provides database logs and API usage stats
3. Both have free tier limits - monitor your usage

## Cost Estimate

- **Supabase Free Tier**: Up to 500MB database, 50MB file storage, 2GB bandwidth
- **Vercel Free Tier**: 100GB bandwidth, unlimited hobby projects
- **Total Monthly Cost**: $0 for small to medium traffic

## Support

If you run into issues:
1. Check the main README.md for troubleshooting tips
2. Review Vercel deployment logs
3. Check Supabase database logs
4. Open an issue in the repository

Happy deploying! 🚀
