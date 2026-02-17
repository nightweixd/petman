# PetMan - Project Overview

## What This Application Does

PetMan is a full-stack pet management system that allows you to:
- View all customers and their pets in one place
- Click into individual pet profiles to see detailed information
- Edit pet information in real-time
- Store all data securely in a cloud database (Supabase)
- Access the application from anywhere via the web

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Next.js Application (React + TypeScript)            │  │
│  │  - Customer List Page (index.tsx)                     │  │
│  │  - Pet Detail Page ([id].tsx)                         │  │
│  │  - Tailwind CSS for styling                           │  │
│  └───────────────────────────────────────────────────────┘  │
│                            ↕                                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Supabase Client (@supabase/supabase-js)             │  │
│  │  - Handles all database operations                    │  │
│  │  - Type-safe queries with TypeScript                  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                         Backend                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Supabase (PostgreSQL + REST API)                    │  │
│  │  ┌─────────────────┐    ┌──────────────────┐         │  │
│  │  │  customers      │    │  pets            │         │  │
│  │  │  - id           │───→│  - id            │         │  │
│  │  │  - customer_id  │    │  - customer_id   │         │  │
│  │  │  - customer_name│    │  - pet_name      │         │  │
│  │  │  - created_at   │    │  - pet_type      │         │  │
│  │  │  - updated_at   │    │  - breed         │         │  │
│  │  └─────────────────┘    │  - age           │         │  │
│  │                          │  - address       │         │  │
│  │                          │  - medical_hist. │         │  │
│  │                          │  - contact       │         │  │
│  │                          │  - preferred_gr. │         │  │
│  │                          │  - created_at    │         │  │
│  │                          │  - updated_at    │         │  │
│  │                          └──────────────────┘         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                      Deployment                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Vercel                                                │  │
│  │  - Hosts the Next.js application                      │  │
│  │  - Automatic deployments from Git                     │  │
│  │  - Environment variable management                    │  │
│  │  - Free SSL certificates                              │  │
│  │  - Global CDN for fast access                         │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Technology Stack Explained

### Frontend Technologies

**Next.js 14**
- React framework for building web applications
- Provides server-side rendering for better SEO and performance
- Built-in routing system (no need for React Router)
- API routes for backend functionality

**React 18**
- Component-based UI library
- Handles all the interactive elements (buttons, forms, navigation)
- State management with hooks (useState, useEffect)

**TypeScript**
- Adds type safety to JavaScript
- Catches errors before runtime
- Better IDE support and autocomplete
- Makes code more maintainable

**Tailwind CSS**
- Utility-first CSS framework
- Rapid UI development with pre-built classes
- Responsive design out of the box
- Consistent styling across the application

### Backend Technologies

**Supabase**
- Open-source Firebase alternative
- PostgreSQL database (industry-standard relational database)
- Automatically generated REST API
- Real-time subscriptions (for future features)
- Row Level Security (RLS) for data protection
- Built-in authentication (not yet implemented)

**PostgreSQL**
- Powerful, open-source relational database
- ACID compliant (reliable transactions)
- Supports complex queries and relationships
- Excellent performance and scalability

### Deployment Platform

**Vercel**
- Cloud platform for Next.js applications
- Automatic HTTPS and SSL certificates
- Global CDN (Content Delivery Network)
- Zero-config deployment
- Preview deployments for every Git push
- Excellent free tier for hobby projects

## Data Flow

### Reading Data (e.g., Loading Customer List)

1. User visits the homepage
2. React component calls `useEffect` hook on mount
3. Component calls `supabase.from('customers').select('*')`
4. Supabase client sends HTTP request to Supabase API
5. Supabase queries PostgreSQL database
6. Database returns customer data
7. Supabase sends data back to client
8. React updates component state
9. UI re-renders with customer data

### Writing Data (e.g., Editing Pet Information)

1. User clicks "Edit" button
2. Form fields become editable
3. User modifies fields and clicks "Save"
4. Component calls `supabase.from('pets').update(formData).eq('id', petId)`
5. Supabase client sends UPDATE request
6. Supabase validates request against RLS policies
7. Database updates the pet record
8. Success response returns to client
9. Component re-fetches updated data
10. UI shows updated information

## File Structure Explained

```
petman-app/
├── lib/                        # Utility functions and shared code
│   └── supabase.ts            # Supabase client configuration
│
├── pages/                     # Next.js pages (each file = route)
│   ├── api/                   # API endpoints (optional, for server-side logic)
│   │   ├── customers.ts       # /api/customers endpoint
│   │   └── pets/
│   │       └── [id].ts        # /api/pets/:id endpoint
│   │
│   ├── pet/                   # Pet-related pages
│   │   └── [id].tsx          # Dynamic route: /pet/:id
│   │
│   ├── _app.tsx              # App wrapper, applies to all pages
│   ├── index.tsx             # Homepage: /
│   └── globals.css           # Global styles
│
├── scripts/                   # Utility scripts
│   └── migrate-data.js       # Data migration from Excel
│
├── .env.local.example        # Example environment variables
├── .gitignore                # Files to exclude from Git
├── DEPLOYMENT.md             # Step-by-step deployment guide
├── next.config.js            # Next.js configuration
├── package.json              # Dependencies and scripts
├── postcss.config.js         # PostCSS configuration (for Tailwind)
├── README.md                 # Main documentation
├── setup.sh                  # Quick setup script
├── supabase-schema.sql       # Database schema and initial data
├── tailwind.config.js        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── vercel.json               # Vercel deployment configuration
```

## Key Features

### Customer List (Homepage)
- Displays all customers in a grid layout
- Shows each customer's pets
- Click on a pet to view detailed information
- Responsive design for mobile and desktop

### Pet Detail Page
- Shows all information about a specific pet
- Edit mode for updating pet information
- Auto-saves changes to database
- Navigation back to customer list
- Last updated timestamp

### Database Features
- Automatic timestamp tracking (created_at, updated_at)
- Foreign key relationships (pets → customers)
- Row Level Security policies
- Indexes for fast queries

## Security Considerations

### Current Implementation (Development)
- Public access to database (anyone can read/write)
- Suitable for development and testing
- **Not recommended for production with sensitive data**

### Recommended for Production
1. **Add Authentication**
   - Use Supabase Auth (email, OAuth, magic links)
   - Require login to access the application

2. **Update RLS Policies**
   - Restrict access based on user roles
   - Only allow users to see their own data
   - Admin role for full access

3. **Add Input Validation**
   - Validate data on client and server
   - Prevent SQL injection (Supabase handles this)
   - Sanitize user inputs

4. **Environment Variables**
   - Never commit `.env.local` to Git
   - Use different credentials for dev/prod
   - Rotate keys periodically

## Extensibility

The application is designed to be easily extended:

### Adding New Features

**New Pet Fields**
1. Add column to database: `ALTER TABLE pets ADD COLUMN vaccination_date DATE;`
2. Update TypeScript type in `lib/supabase.ts`
3. Add field to form in `pages/pet/[id].tsx`

**Add New Pages**
- Create new file in `pages/` directory
- File name becomes the route (e.g., `about.tsx` → `/about`)

**Add Authentication**
1. Enable Supabase Auth in dashboard
2. Install auth helpers: `npm install @supabase/auth-helpers-nextjs`
3. Add login/signup pages
4. Protect routes with middleware

**Add Search Functionality**
- Add search input to homepage
- Filter customers/pets client-side for small datasets
- Use PostgreSQL full-text search for large datasets

**Add Appointments System**
- Create new `appointments` table in Supabase
- Link to pets and customers via foreign keys
- Build calendar UI component
- Add booking/scheduling logic

### Performance Optimization

**For Large Datasets**
- Implement pagination (limit results per page)
- Add infinite scroll or "Load More" button
- Use Supabase's built-in pagination

**For Faster Loads**
- Enable ISR (Incremental Static Regeneration)
- Add caching headers
- Optimize images with Next.js Image component

## Development Workflow

### Local Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Run production build locally
npm run lint         # Check code quality
```

### Git Workflow
```bash
git add .
git commit -m "Description of changes"
git push origin main
```
Vercel automatically deploys on push to main branch

### Database Changes
1. Update schema in Supabase SQL editor
2. Test changes in development
3. Export schema if needed
4. Apply to production database

## Costs and Scaling

### Free Tier Limits
- **Supabase**: 500MB database, 1GB file storage, 2GB bandwidth
- **Vercel**: 100GB bandwidth, unlimited hobby projects
- **Suitable for**: Up to ~1,000 customers with moderate usage

### When to Upgrade
- More than 500MB of data → Upgrade Supabase ($25/mo)
- High traffic → Upgrade Vercel ($20/mo per member)
- Need more features → Pro plans unlock advanced features

### Scaling Strategy
1. Start with free tiers
2. Monitor usage in dashboards
3. Upgrade specific services as needed
4. Consider database optimization before upgrading
5. Add caching and CDN for global users

## Support and Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

## Future Enhancements

Potential features to add:
- [ ] User authentication and authorization
- [ ] Photo uploads for pets
- [ ] Appointment scheduling system
- [ ] Email notifications and reminders
- [ ] PDF report generation
- [ ] Export data to Excel/CSV
- [ ] Mobile app (React Native)
- [ ] Analytics dashboard
- [ ] Multi-language support
- [ ] Dark mode
