[See integration playbook. Emergent Google Auth testing playbook saved for reference.]

# Auth-Gated App Testing Playbook (Emergent Google Auth)

## Step 1: Create Test User & Session in Mongo
Use db `test_database`. The admin email MUST be in ADMIN_EMAILS (see /app/backend/.env).

mongosh --eval "
use('test_database');
var userId = 'user_test' + Date.now();
var sessionToken = 'test_session_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'z6md2dmmvg@privaterelay.appleid.com',
  name: 'Test Admin',
  picture: '',
  created_at: new Date().toISOString()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('Session token: ' + sessionToken);
"

## Step 2: Test Backend
curl -X GET "$URL/api/auth/me" -H "Authorization: Bearer <TOKEN>"
curl -X GET "$URL/api/admin/bookings?status=all" -H "Authorization: Bearer <TOKEN>"

## Step 3: Browser Testing
Set cookie session_token (httpOnly, secure, sameSite None) on the app domain, then navigate to /admin.

## Checklist
- users doc has user_id (custom); email is in ADMIN_EMAILS
- user_sessions.user_id matches users.user_id
- All queries use {"_id": 0}
- Callback detection uses useLocation().hash
