# 🔧 Database & CORS Verification Checklist

## ⚠️ IMPORTANT: These Steps Must Be Done in Supabase Dashboard

I cannot access your Supabase account from here. You need to do these steps manually.

---

## 📋 Step 1: Check if Database Migration Was Applied

### How to Check:

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project

2. **Check Tables (Method 1 - Quick Check)**
   - Click: **Database** (left sidebar)
   - Click: **Tables**
   - Look for these tables:
     - ✅ profiles
     - ✅ user_roles
     - ✅ regions
     - ✅ team_leaders
     - ✅ distribution_executives (NEW - this confirms fresh migration)
     - ✅ dsrs
     - ✅ stock
     - ✅ sales
     - ✅ commissions

3. **Check Regions Data (Method 2 - Confirm Migration Ran)**
   - Click: **Table Editor** → **regions**
   - You should see exactly **3 regions**:
     - Dar es Salaam (DSM)
     - Arusha (ARU)
     - Mwanza (MWZ)
   - If you see these 3 regions → ✅ Migration was applied
   - If table doesn't exist → ❌ Migration NOT applied yet

4. **Check Functions (Method 3 - Advanced Check)**
   - Click: **Database** → **Functions**
   - Look for:
     - ✅ is_admin(uuid)
     - ✅ has_role(uuid, app_role)
     - ✅ get_user_role(uuid)
     - ✅ handle_new_user()
     - ✅ generate_sale_id()
     - ✅ generate_stock_id()

---

## ❌ If Migration Was NOT Applied

### Apply it now:

1. **Open SQL Editor**
   - Click: **SQL Editor** (left sidebar)
   - Click: **New query**

2. **Copy & Paste Migration**
   - Open file: `supabase/migrations/20251205_FRESH_START_complete_rebuild.sql`
   - Copy ENTIRE file (all 670 lines)
   - Paste into SQL Editor

3. **Run**
   - Click: **Run** button (or Ctrl+Enter)
   - Wait 10-30 seconds
   - Look for: ✅ "Query executed successfully"
   - Look for notice: "DATABASE REBUILD COMPLETE!"

4. **Verify**
   - Go to **Table Editor** → **regions**
   - Should see 3 regions

---

## 🌐 Step 2: Configure CORS

### Current CORS Settings Check:

1. **Open CORS Settings**
   - Go to: https://supabase.com/dashboard
   - Select your project
   - Click: **Settings** (left sidebar)
   - Click: **API** tab
   - Scroll to: **"CORS allowed origins"** section

2. **Check If These URLs Are Added**
   - [ ] `http://localhost:8080`
   - [ ] `http://localhost:5173`
   - [ ] `http://localhost:3000`
   - [ ] `http://127.0.0.1:8080`

### If NOT Added - Add Them Now:

1. **In the CORS section**
   - Find the input field or "Add" button
   - Add each URL one by one:
     ```
     http://localhost:8080
     http://localhost:5173
     http://localhost:3000
     http://127.0.0.1:8080
     ```

2. **Save**
   - Click: **Save** or **Update** button
   - Wait for confirmation message

---

## ✅ Step 3: Test Everything Works

### After Both Steps Are Done:

1. **Start Dev Server**
   ```powershell
   npm run dev
   ```

2. **Open in Browser**
   - Go to: http://localhost:8080 (or the port shown in terminal)

3. **Test Signup**
   - Click: **Sign Up**
   - Fill in:
     - Email: test@example.com
     - Password: Test123456
     - Full Name: Test User
     - Phone: +255123456789
     - Role: **Admin**
     - Region: Any region
   - Click: **Sign Up**

4. **Check Results**
   - ✅ **SUCCESS**: You're redirected to dashboard
   - ❌ **500 Error**: Database migration not applied OR RLS policies not working
   - ❌ **CORS Error**: CORS not configured properly
   - ❌ **Connection Error**: Wrong Supabase credentials in .env

### Expected Behavior After Successful Setup:

- ✅ Sign up works without errors
- ✅ Automatically logged in
- ✅ Dashboard loads with metrics
- ✅ Can navigate between different sections
- ✅ No 500 errors in browser console (F12)
- ✅ No CORS errors in browser console

---

## 🔍 Troubleshooting

### If you see "500 Internal Server Error":

**Cause**: Database migration not applied OR RLS policies broken

**Fix**:
1. Go to Supabase Dashboard → SQL Editor
2. Run this test query:
   ```sql
   SELECT * FROM public.regions LIMIT 1;
   ```
3. If error → Migration not applied → Apply the migration
4. If works → Check browser console for exact error

### If you see "CORS error" or "blocked by CORS policy":

**Cause**: CORS not configured in Supabase

**Fix**:
1. Go to Supabase Dashboard → Settings → API
2. Add all 4 localhost URLs to CORS
3. Click Save
4. Restart dev server
5. Clear browser cache (Ctrl+Shift+Delete)

### If nothing loads:

**Cause**: Missing or wrong environment variables

**Fix**:
1. Check `.env` file exists in project root
2. Verify it has:
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
   ```
3. Get correct values from Supabase Dashboard → Settings → API
4. Restart dev server

---

## 📊 Quick Status Check Commands

Run these in your terminal to verify local setup:

```powershell
# Check if .env file exists
Test-Path .env

# Check if dist folder was built
Test-Path dist

# Check if node_modules exist
Test-Path node_modules

# View Supabase URL (if .env exists)
Get-Content .env | Select-String "VITE_SUPABASE_URL"
```

---

## ✅ Verification Checklist

Before considering setup complete, verify:

- [ ] Database migration applied (tables exist in Supabase)
- [ ] 3 regions exist in regions table
- [ ] Helper functions created (is_admin, has_role, etc.)
- [ ] CORS configured with 4 localhost URLs
- [ ] .env file has correct Supabase credentials
- [ ] App builds successfully (`npm run build`)
- [ ] Dev server starts without errors (`npm run dev`)
- [ ] Can access app in browser
- [ ] Sign up works without 500 errors
- [ ] Can log in successfully
- [ ] Dashboard loads with data
- [ ] No errors in browser console

---

## 🎯 Current Status Based on Our Work:

✅ **Code**: All fixed and builds successfully  
✅ **Migration File**: Created and ready to apply  
⏳ **Database**: You need to apply migration in Supabase  
⏳ **CORS**: You need to configure in Supabase  
⏳ **Testing**: After above 2 steps, test the app  

---

**Next Action**: Go to Supabase Dashboard and complete Steps 1 & 2 above! 🚀
