# Netlify Deployment Instructions

## Prerequisites
1. Git repository set up
2. Netlify account
3. PostgreSQL database (local or hosted)
4. Node.js installed locally for testing

---

## Step 1: Set Up Environment Variables

Go to your Netlify site and navigate to:
**Site settings → Build & deploy → Environment → Environment variables**

Add these variables:
```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
```

**For PostgreSQL Connection Strings:**
- **Local**: `postgresql://postgres:password@localhost:5432/tecmifix`
- **Heroku Postgres**: `postgresql://user:password@host.compute-1.amazonaws.com:5432/database`
- **Railway.app**: Copy from dashboard (includes `?sslmode=require`)
- **Supabase**: Copy from Connection String

---

## Step 2: Deploy Changes

### Option A: Git Push (Recommended)
```bash
git add .
git commit -m "Fix Netlify deployment: API endpoints, CORS, and routing"
git push origin main
```
Netlify will automatically deploy the changes.

### Option B: Manual Deployment
1. Connect your GitHub repo to Netlify
2. Set production branch to `main` or your deployment branch
3. Netlify will auto-deploy on pushes

---

## Step 3: Verify Deployment

1. **Check Build Logs**
   - Go to Deploys → Latest Deploy
   - Ensure `netlify/functions/*` files compiled successfully

2. **Test Endpoints**
   - Open browser console
   - Go to `/registration.html` and create account
   - Check Network tab to see requests to `/api/register`
   - Should get 201 response with user data

3. **Test Each Feature**
   ```bash
   # Test registration
   curl -X POST https://your-site.netlify.app/api/register \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","email":"test@tecmilenio.mx","password":"password123"}'

   # Test login  
   curl -X POST https://your-site.netlify.app/api/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@tecmilenio.mx","password":"password123"}'

   # Test verify (need valid token)
   curl -X GET https://your-site.netlify.app/api/verify \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```

---

## Step 4: Database Setup

Ensure your PostgreSQL database has these tables:

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE maintenance_staff (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    specialty VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tickets (
    id SERIAL PRIMARY KEY,
    folio VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id),
    issue_type VARCHAR(255),
    description TEXT,
    status VARCHAR(50) DEFAULT 'abierto',
    priority VARCHAR(50) DEFAULT 'media',
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE ticket_images (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id),
    image_url LONGTEXT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ticket_updates (
    id SERIAL PRIMARY KEY,
    ticket_id INTEGER REFERENCES tickets(id),
    user_id INTEGER REFERENCES users(id),
    status VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Troubleshooting

### Issue: 404 Errors on API Calls
**Solution:**
- Verify `netlify.toml` redirects are correct
- Check function names match file names in `netlify/functions/`
- Rebuild the site (Deploys → Trigger deploy → Deploy site)

### Issue: CORS Errors
**Solution:**
- Check browser console for CORS error details
- Verify `Access-Control-Allow-Origin` headers in functions
- All functions should include OPTIONS method handling

### Issue: 500 Errors on Function Calls
**Solution:**
- Check function logs: Netlify dashboard → Functions → Click function → Logs
- Verify environment variables are set correctly
- Test database connection locally with same `DATABASE_URL`

### Issue: "Token Expired" After 24 Hours
**Expected behavior** - Users need to log in again. To change:
Edit `netlify/functions/login.js`:
```javascript
const token = jwt.sign(
    {...},
    JWT_SECRET,
    { expiresIn: '7d' }  // Change from '24h' to desired duration
);
```

### Issue: Database Connection Timeout
**Solution:**
- Verify database is accessible from Netlify servers
- Add Netlify's IP addresses to database firewall (if using managed DB)
- Check connection string includes correct host/port
- For Supabase: ensure SSL mode is enabled

---

## Performance Optimization

### Image Handling
Currently, images are stored as base64 in database. For production:

```javascript
// Use Cloudinary or similar service
const uploadImage = async (image) => {
    const formData = new FormData();
    formData.append('file', image);
    
    const response = await fetch('https://api.cloudinary.com/v1_1/YOUR_CLOUD/upload', {
        method: 'POST',
        body: formData
    });
    
    return response.json().secure_url;
};
```

### Database Optimization
Add indexes for better query performance:
```sql
CREATE INDEX idx_tickets_user_id ON tickets(user_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_ticket_images_ticket_id ON ticket_images(ticket_id);
CREATE INDEX idx_ticket_updates_ticket_id ON ticket_updates(ticket_id);
```

---

## Monitoring

### Enable Function Logs
All `console.log()` statements in functions appear in:
- Netlify Dashboard → Functions → Logs
- Or via CLI: `netlify functions:log`

### Set Up Error Notifications
- Go to Netlify Dashboard → Integrations
- Add Slack or Email notifications for deploy failures

---

## Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback**
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Via Netlify Dashboard**
   - Go to Deploys
   - Click on previous successful deploy
   - Click "Publish deploy"

---

## Next Steps

1. ✅ Deploy these fixes
2. Test all features thoroughly
3. Monitor function logs for errors
4. Consider migrating base64 images to cloud storage
5. Set up error tracking (Sentry, Rollbar, etc.)
6. Monitor database performance

---

## Support

- **Netlify Docs**: https://docs.netlify.com/
- **PostgreSQL Docs**: https://www.postgresql.org/docs/
- **JWT Docs**: https://jwt.io/
- **Function Limits**: Functions have 26 second timeout, 256 MB memory limit

