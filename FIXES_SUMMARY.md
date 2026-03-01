# TecmiFix - Netlify Deployment Fixes

## Summary
Fixed critical issues preventing login, registration, and ticket management from working on Netlify deployment. The main problems were environment variable usage in browser code and endpoint path mismatches between frontend and backend.

---

## Issues Fixed

### 1. **API Base URL Configuration** ❌ → ✅
**Problem:** 
- `script.js` was using `process.env.REACT_APP_API_URL` which doesn't exist in browser code
- Fallback to `http://localhost:3000/api` doesn't work in production

**Solution:**
- Changed `API_BASE_URL` to simply use `/api`
- Works both locally and in production (relative path)
- File: `public/js/script.js` (Line 6)

```javascript
// Before
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

// After
const API_BASE_URL = '/api';
```

---

### 2. **Endpoint Path Mismatches** ❌ → ✅
**Problem:**
- Frontend calling `/api/auth/login`, `/api/auth/register`, `/api/auth/verify`, `/api/auth/logout`
- Backend functions named `login.js`, `register.js`, `verify.js`, `logout.js` (without `/auth/` prefix)
- Netlify routing with redirects was looking for exact file names

**Solution:**
Updated all endpoint paths:
- `/api/auth/register` → `/api/register`
- `/api/auth/login` → `/api/login`
- `/api/auth/verify` → `/api/verify`
- `/api/auth/logout` → `/api/logout`

Files updated: `public/js/script.js`

---

### 3. **Complex Ticket Routing** ❌ → ✅
**Problem:**
- Calling `/api/tickets/{id}`, `/api/tickets/{id}/images`, `/api/tickets/{id}/status`
- Netlify Functions doesn't support dynamic path parameters like Express
- Path-based routing for `/tickets/user/my-tickets` was fragile

**Solution:**
Converted to query parameter-based routing:
- `/api/tickets/{id}` → `/api/tickets?id={id}`
- `/api/tickets/user/my-tickets` → `/api/tickets?my=true`
- `/api/tickets/{id}/images` → `/api/tickets?id={id}` (images returned with ticket)
- `/api/tickets/{id}/status` → `/api/tickets-update` (dedicated endpoint)

Updated functions:
- `tickets.js` - Added custom logic to handle `my=true` and `id` query parameters
- Removed redundant `/my-tickets` path checking

---

### 4. **Request/Response Field Mismatches** ❌ → ✅
**Problem:**
- Frontend sending `imagenes`, backend expecting `images`
- Frontend not sending `ticketId` in status update request
- Images parsing looking for wrong response structure

**Solutions:**

a) **Image field naming:**
```javascript
// Before
imagenes: appState.imagenesBase64

// After
images: appState.imagenesBase64
```

b) **Missing ticketId in status update:**
```javascript
// Before
{ status: nuevoEstatus, notes: notas }

// After
{ ticketId: ticketId, status: nuevoEstatus, notes: notas }
```

c) **Image extraction fix:**
```javascript
// Before
if (data.images && data.images.length > 0)

// After
const images = data.ticket?.images || data.images || [];
```

---

### 5. **Login Response Role Field** ❌ → ✅
**Problem:**
- Frontend checking `user.role === 'admin'`
- Backend returning `is_staff` field instead of `role`
- Caused routing to dashboard instead of admin panel

**Solution:**
Updated `login.js` to return both fields:
```javascript
{
    id: user.id,
    name: user.name,
    email: user.email,
    role: !!user.is_staff ? 'admin' : 'user',  // New field
    is_staff: !!user.is_staff,                  // Keep for backward compatibility
    specialty: user.specialty
}
```

---

### 6. **CORS Preflight Handling** ❌ → ✅
**Problem:**
- Missing `OPTIONS` method handling in some functions
- Incomplete CORS headers causing browser preflight failures

**Solution:**
Added OPTIONS method handling to all auth functions:
- `login.js`
- `register.js`
- `logout.js`
- `verify.js`
- `tickets.js` (already had it)
- `tickets-update.js` (already had it)

All functions now include:
```javascript
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
};

if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
}
```

---

### 7. **Netlify Configuration** ❌ → ✅
**Problem:**
- Generic catch-all redirect too flexible, no explicit routing
- Complex routes not properly mapped

**Solution:**
Updated `netlify.toml` with explicit, prioritized redirects:

```toml
[build]
  functions = "netlify/functions"

# Specific route overrides
[[redirects]]
  from = "/api/register"
  to = "/.netlify/functions/register"
  status = 200

[[redirects]]
  from = "/api/login"
  to = "/.netlify/functions/login"
  status = 200

[[redirects]]
  from = "/api/logout"
  to = "/.netlify/functions/logout"
  status = 200

[[redirects]]
  from = "/api/verify"
  to = "/.netlify/functions/verify"
  status = 200

[[redirects]]
  from = "/api/tickets"
  to = "/.netlify/functions/tickets"
  status = 200

[[redirects]]
  from = "/api/tickets-update"
  to = "/.netlify/functions/tickets-update"
  status = 200

# Catch-all fallback (last)
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

---

## Testing Checklist

After deploying to Netlify, test:

- [ ] **Registration** - Create new user account
- [ ] **Login** - Log in with credentials
- [ ] **Role Routing** - Admin redirects to `/admin.html`, users to `/dashboard.html`
- [ ] **Create Ticket** - Submit ticket with description and images
- [ ] **View Tickets** - Display user's tickets in modal
- [ ] **View Details** - Click on ticket to see full details with images
- [ ] **Admin Panel** - View all tickets with filters
- [ ] **Update Status** - Change ticket status (admin only)
- [ ] **Logout** - Clear session and redirect to login

---

## Environment Variables Required

Add these to your Netlify site settings (Site settings → Build & deploy → Environment):

```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-change-in-production
```

---

## Files Modified

### Frontend
- `public/js/script.js` - API endpoints, query parameters, field names

### Backend
- `netlify.toml` - Redirect rules
- `netlify/functions/login.js` - CORS headers, OPTIONS, role field
- `netlify/functions/register.js` - CORS headers, OPTIONS
- `netlify/functions/verify.js` - CORS headers, OPTIONS
- `netlify/functions/logout.js` - CORS headers, OPTIONS
- `netlify/functions/tickets.js` - Query parameter handling for `my=true` and `id`

---

## Key Changes Summary

| Issue | Before | After |
|-------|--------|-------|
| API Base URL | `process.env` (breaks in browser) | `/api` (relative path) |
| Auth Endpoints | `/api/auth/*` | `/api/*` |
| Single Ticket | `/api/tickets/{id}` | `/api/tickets?id={id}` |
| My Tickets | `/api/tickets/user/my-tickets` | `/api/tickets?my=true` |
| Images | `/api/tickets/{id}/images` | Extracted from `/api/tickets?id={id}` |
| Status Update | `/api/tickets/{id}/status` | `/api/tickets-update` |
| Image Field | `imagenes` | `images` |
| User Role Check | `user.is_staff` | `user.role` ✓ `user.is_staff` |
| CORS | Incomplete | Complete with OPTIONS ✓ |

---

## Notes

1. **Base64 Images**: Currently stored as base64 in the database. For production, consider using cloud storage (S3, Cloudinary, etc.)
2. **Token Expiration**: JWT tokens expire after 24 hours
3. **CORS**: All endpoints now accept CORS requests from any origin (`*`)
4. **Credentials**: Changed `credentials: 'include'` usage to rely on token in Authorization header

