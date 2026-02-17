# PetMan - Pet Management System

A modern pet management application built with Next.js and Supabase, designed to manage customer and pet information.

## Features

- 📋 Customer list with all their pets
- 🐾 Detailed pet profiles with editable information
- ✏️ In-place editing of pet details
- 💾 Real-time data synchronization with Supabase
- 📱 Responsive design for mobile and desktop
- 🎨 Clean, modern UI with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Backend**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)
- A Vercel account (free tier works)

### 1. Set Up Supabase

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Once your project is ready, go to the SQL Editor
3. Copy and paste the contents of `supabase-schema.sql` into the SQL editor
4. Run the SQL script to create tables, policies, and insert initial data
5. Go to Project Settings > API to get your credentials:
   - Project URL
   - Anon/Public API Key

### 2. Local Development Setup

1. Clone this repository:
   ```bash
   git clone <your-repo-url>
   cd petman-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### 3. Deploy to Vercel

#### Option A: Deploy via Vercel CLI

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts and add your environment variables when asked

#### Option B: Deploy via Vercel Dashboard

1. Push your code to GitHub/GitLab/Bitbucket

2. Go to [vercel.com](https://vercel.com) and click "New Project"

3. Import your repository

4. Configure your project:
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

5. Add Environment Variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL = your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY = your_supabase_anon_key
   ```

6. Click "Deploy"

Your app will be live at `https://your-project.vercel.app`

## Project Structure

```
petman-app/
├── lib/
│   └── supabase.ts          # Supabase client and TypeScript types
├── pages/
│   ├── api/                 # API routes (if needed)
│   ├── pet/
│   │   └── [id].tsx         # Dynamic pet detail page
│   ├── _app.tsx             # App wrapper
│   ├── index.tsx            # Home page with customer list
│   └── globals.css          # Global styles
├── supabase-schema.sql      # Database schema and initial data
├── .env.local.example       # Example environment variables
├── next.config.js           # Next.js configuration
├── tailwind.config.js       # Tailwind CSS configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies
```

## Database Schema

### Customers Table
- `id` (UUID, primary key)
- `customer_id` (VARCHAR, unique)
- `customer_name` (VARCHAR, not null)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

### Pets Table
- `id` (UUID, primary key)
- `customer_id` (UUID, foreign key)
- `pet_name` (VARCHAR, not null)
- `pet_type` (VARCHAR)
- `breed` (VARCHAR)
- `age` (DECIMAL)
- `address` (TEXT)
- `medical_history` (TEXT)
- `contact` (VARCHAR)
- `preferred_groomer` (VARCHAR)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anonymous/public API key |

## Security Notes

The current setup uses Row Level Security (RLS) with public access policies for simplicity. For production use, you should:

1. Implement authentication (Supabase Auth)
2. Update RLS policies to restrict access based on authenticated users
3. Add user roles and permissions
4. Consider adding API rate limiting

## Customization

### Adding New Fields

1. Update the database schema in Supabase:
   ```sql
   ALTER TABLE pets ADD COLUMN new_field VARCHAR(255);
   ```

2. Update TypeScript types in `lib/supabase.ts`:
   ```typescript
   export type Pet = {
     // existing fields...
     new_field: string | null
   }
   ```

3. Add the field to the form in `pages/pet/[id].tsx`

### Styling

The app uses Tailwind CSS. Modify styles in:
- Component classes for local changes
- `tailwind.config.js` for theme customization
- `pages/globals.css` for global styles

## Troubleshooting

### "Failed to fetch" errors
- Check that your Supabase URL and API key are correct in `.env.local`
- Verify that RLS policies are enabled and configured correctly
- Check browser console for specific error messages

### Build errors on Vercel
- Ensure all environment variables are set in Vercel dashboard
- Check that your Node.js version matches (18+)
- Review build logs for specific errors

### Database connection issues
- Verify your Supabase project is active
- Check that the database tables were created correctly
- Test the connection using Supabase dashboard

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT
