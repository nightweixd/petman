# 🚀 How to Deploy PetMan (Step by Step)

You have the project files. Follow these steps in order.
Total time: ~15 minutes.

---

## PART 1 — Set up Supabase (your database)

**Step 1** — Go to https://supabase.com and sign up for free

**Step 2** — Click **"New Project"**, fill in:
- Name: `petman`
- Database Password: anything you like (save it!)
- Region: pick the closest one to you
- Click **"Create new project"** and wait ~2 min

**Step 3** — Once ready, click **"SQL Editor"** in the left sidebar

**Step 4** — Click **"New Query"**, then:
- Open the file `supabase-schema.sql` from this folder
- Select ALL the text (Ctrl+A) and copy it
- Paste it into the SQL editor
- Click **"Run"**
- You should see: *"Success. No rows returned"* ✅

**Step 5** — Get your API keys:
- Click ⚙️ **Settings** in the left sidebar
- Click **"API"**
- Copy and save these two things somewhere:
  - **Project URL** → looks like `https://xxxxxxxx.supabase.co`
  - **anon/public key** → long text starting with `eyJ...`

---

## PART 2 — Deploy to Vercel (your website host)

**Step 6** — Go to https://github.com and sign up (free), then create a new repository:
- Click **"+"** → **"New repository"**
- Name it `petman`
- Set to **Public**
- Click **"Create repository"**

**Step 7** — Upload your files to GitHub:
- On the new repo page, click **"uploading an existing file"**
- Drag and drop the entire `petman-app` folder contents (all files inside it)
- Click **"Commit changes"**

**Step 8** — Go to https://vercel.com and sign up using your GitHub account

**Step 9** — Click **"Add New Project"**:
- Find and select your `petman` repository
- Click **"Import"**

**Step 10** — On the configuration screen:
- Framework: **Next.js** (should auto-detect ✅)
- Leave everything else as default
- Scroll down to **"Environment Variables"** and add these two:

  | Name | Value |
  |------|-------|
  | `NEXT_PUBLIC_SUPABASE_URL` | your Project URL from Step 5 |
  | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon key from Step 5 |

**Step 11** — Click **"Deploy"** and wait ~2 minutes

**Step 12** — Vercel gives you a URL like `https://petman-xxxx.vercel.app`
- Click **"Visit"** — your app is live! 🎉

---

## Something went wrong?

**Page shows error / blank**
→ Check that you added both environment variables correctly in Step 10
→ In Vercel: go to your project → Settings → Environment Variables

**Database is empty**
→ Go back to Supabase SQL Editor and re-run the `supabase-schema.sql` file

**Build failed**
→ In Vercel, click on the failed deployment → View logs → look for the red error line

---

## After deploying

- Your app is live at the Vercel URL
- Every time you push changes to GitHub, Vercel auto-redeploys
- Data is saved in Supabase — it persists across sessions
- Share the URL with your team so multiple people can use it

---

That's it! 🐾
