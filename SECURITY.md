# 🛡️ Security Guide for ExpenseKeeper

## ✅ Current Security Measures

### 1. **Authentication & Authorization**
- ✅ JWT tokens for authentication
- ✅ Password hashing (bcrypt with 10 salt rounds)
- ✅ Token expiration (7 days)
- ✅ Protected routes with auth middleware
- ✅ OAuth 2.0 (Google Sign-In, Discord OAuth)
- ✅ Password change requires current password verification
- ✅ OAuth accounts protected from password changes

### 2. **Input Validation**
- ✅ Zod schema validation on all inputs (auth, expenses, user updates, predictions)
- ✅ Request body size limits (1MB)
- ✅ Type checking and sanitization
- ✅ Password strength validation (min 6 chars, uppercase, digit, special character)
- ✅ Email format validation
- ✅ User type enum validation

### 3. **Rate Limiting**
- ✅ General API: 50 requests/minute per IP
- ✅ Auth endpoints: 5 requests/minute per IP
- ✅ Redis-backed rate limiting for distributed systems

### 4. **Bot Protection**
- ✅ Cloudflare Turnstile CAPTCHA on login/signup pages
- ✅ Server-side Turnstile token verification with Cloudflare API
- ✅ CAPTCHA tokens single-use and time-limited
- ✅ Frontend-side CAPTCHA validation with user feedback

### 5. **HTTP Security Headers**
- ✅ Helmet.js enabled
  - X-Frame-Options: DENY
  - X-Content-Type-Options: nosniff
  - X-XSS-Protection: 1
  - Strict-Transport-Security (HSTS)

### 6. **CORS Protection**
- ✅ **FIXED**: Restricted to specific origins only
- ✅ Credentials allowed only for whitelisted domains

---

## ⚠️ Security Vulnerabilities Fixed

### 🔴 CRITICAL: CORS Misconfiguration (FIXED)
**Issue**: CORS was set to `*` allowing any origin
**Fix**: Whitelist specific origins only
**Impact**: Prevents CSRF attacks from malicious websites

---

## 🔒 Security Checklist

### Environment Variables (.env files)
- [ ] Never commit `.env` files to Git
- [ ] Use strong, random JWT_SECRET (min 32 characters)
- [ ] Keep OAuth secrets confidential
- [ ] Use different secrets for dev/production

### Database Security
- [ ] Use environment variables for DB credentials
- [ ] Enable MongoDB authentication
- [ ] Use connection string encryption
### Password Security
- ✅ Min 6 characters (enforced on frontend and backend)
- ✅ Require uppercase letter (A-Z)
- ✅ Require number (0-9)
- ✅ Require special character (@$!%*?&)
- ✅ Passwords hashed with bcrypt (10 salt rounds)
- ✅ Real-time password strength validation on frontend
- ✅ Visual password strength checklist for user feedback
- ✅ Password visibility toggle (Eye/EyeOff icons)
### API Security
- ✅ Rate limiting enabled (50 req/min general, 5 req/min auth)
- ✅ Input validation on all endpoints with detailed error messages
- ✅ Authentication required for protected routes
- ✅ JWT tokens expire after 7 days
- ✅ User profile updates validate ownership
- ✅ Account deletion requires authentication
- ✅ Expense operations restricted to owner
- ✅ OAuth provider validation on account linking

### API Security
- ✅ Rate limiting enabled
- ✅ Input validation on all endpoints
- ✅ Authentication required for protected routes
- ✅ JWT tokens expire after 7 days

---

## 🚀 Additional Security Recommendations

### High Priority

#### 1. **Add HTTPS in Production**
```javascript
// Redirect HTTP to HTTPS
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

#### 2. **Add Security Headers Enhancement**
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

#### 3. **Add Request Logging for Security Monitoring**
```javascript
// Log suspicious activities
app.use((req, res, next) => {
  if (req.path.includes('..') || req.path.includes('passwd')) {
    console.warn(`⚠️ Suspicious request from ${req.ip}: ${req.path}`);
  }
  next();
});
```

#### 4. **Sanitize User Input (XSS Prevention)**
```bash
npm install express-mongo-sanitize xss-clean
```
```javascript
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

app.use(mongoSanitize()); // Prevent NoSQL injection
app.use(xss()); // Prevent XSS attacks
```

#### 5. **Add CSRF Protection for Cookie-based Auth**
If you plan to use cookies:
```bash
npm install csurf
```

#### 6. **Implement Refresh Tokens**
### Medium Priority

#### 7. **Add Account Security Features**
- ✅ Password change with current password verification
- ✅ Account deletion with confirmation
- ✅ OAuth account protection (no password changes)
- Email verification on signup (TODO)
- Password reset via email (TODO)
- Two-factor authentication (2FA) (TODO)
- Login notification emails (TODO)
- Session management (view active sessions) (TODO)
- Password reset via email
- Two-factor authentication (2FA)
- Login notification emails
- Session management (view active sessions)

#### 8. **Add Audit Logging**
```javascript
// Log important actions
function auditLog(userId, action, details) {
  console.log(`[AUDIT] ${new Date().toISOString()} - User ${userId} - ${action} - ${JSON.stringify(details)}`);
  // Save to database for compliance
}
```

#### 9. **Implement Data Encryption**
```javascript
// Encrypt sensitive data at rest
import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}
```

#### 10. **Add File Upload Security** (if you plan to add this feature)
- Validate file types
- Limit file sizes
- Scan for malware
- Store files outside web root
- Use random filenames

---

## 🧪 Security Testing Tools

### 1. **Automated Vulnerability Scanning**
```bash
# Check for vulnerable dependencies
npm audit

# Fix vulnerabilities
npm audit fix
```

### 2. **OWASP ZAP** (Free)
- Web application security scanner
- https://www.zaproxy.org/

### 3. **Postman Security Testing**
- Test API endpoints with invalid inputs
- Test authentication bypass attempts
- Test rate limiting

### 4. **Browser DevTools Security Audit**
- Chrome Lighthouse (Security audit)
- Check for mixed content warnings
- Verify HTTPS certificate

---
| Attack Type | Protection | Status |
|-------------|------------|--------|
| SQL/NoSQL Injection | Input validation, sanitization | ✅ Zod validation + Mongoose |
| XSS (Cross-Site Scripting) | Input sanitization, CSP headers | ⚠️ Need xss-clean |
| CSRF (Cross-Site Request Forgery) | CSRF tokens, SameSite cookies | ✅ CORS restricted |
| Brute Force | Rate limiting, CAPTCHA | ✅ Turnstile + Rate limiting |
| DDoS | Rate limiting, CDN, WAF | ✅ Redis rate limiting |
| Man-in-the-Middle | HTTPS, HSTS | ⚠️ Enable in prod |
| Session Hijacking | Secure cookies, token expiry | ✅ JWT expiry (7d) |
| Credential Stuffing | Rate limiting, CAPTCHA, 2FA | ✅ Turnstile CAPTCHA |
| Password Cracking | Strong password policy, bcrypt | ✅ Regex validation + bcrypt |
| OAuth Token Theft | Secure token handling, HTTPS | ✅ Backend verification |
| Account Takeover | Password verification for changes | ✅ Current password required |
| Man-in-the-Middle | HTTPS, HSTS | ⚠️ Enable in prod |
| Session Hijacking | Secure cookies, token expiry | ✅ JWT expiry |
| Credential Stuffing | Rate limiting, CAPTCHA, 2FA | ✅ CAPTCHA enabled |

---

## 📝 Environment Variables Security

### Required Environment Variables

**Backend (.env)**
```env
# Database
MONGO_URI=mongodb+srv://...

# Authentication
JWT_SECRET=<64-character-random-string>
JWT_EXPIRES_IN=7d

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...

# Turnstile CAPTCHA
TURNSTILE_SECRET_KEY=...

# Redis
REDIS_HOST=...
REDIS_PORT=...
REDIS_USERNAME=...
REDIS_PASSWORD=...

# CORS
CORS_ORIGIN=http://localhost:5173

# Other
NODE_ENV=development
PORT=5000
ML_API_URL=http://localhost:8000
```

**Frontend (.env)**
```env
VITE_API_TARGET=http://localhost:5000
VITE_ML_API_URL=http://localhost:8000
VITE_GOOGLE_CLIENT_ID=...
VITE_DISCORD_CLIENT_ID=...
VITE_DISCORD_REDIRECT_URI=...
VITE_TURNSTILE_SITE_KEY=...
```

### Generate Strong Secrets
```bash
# Generate JWT secret
### GDPR Compliance (if serving EU users)
- [ ] Privacy policy page
- [ ] Cookie consent banner
- [ ] User data export feature
- ✅ Account deletion feature (DELETE /api/user/profile/delete)
- [ ] Data retention policy
- ✅ Encrypted password storage (bcrypt)
### GDPR Compliance (if serving EU users)
- [ ] Privacy policy page
- [ ] Cookie consent banner
- [ ] User data export feature
- [ ] Account deletion feature
- [ ] Data retention policy
- [ ] Encrypted data storage

### Best Practices
- Only collect necessary data
- Hash/encrypt sensitive data
- Regular security audits
- Incident response plan
- User notification on breaches

---

## 🚨 Security Incident Response Plan

### If Security Breach Occurs:

1. **Immediate Actions**
   - Identify and stop the attack
   - Change all secrets and passwords
   - Revoke all active JWT tokens
   - Enable maintenance mode if needed

2. **Investigation**
   - Check logs for unauthorized access
   - Identify compromised data
   - Determine attack vector

3. **Communication**
   - Notify affected users
   - Report to authorities if required
   - Update security measures

4. **Recovery**
   - Patch vulnerabilities
   - Restore from clean backups
   - Monitor for continued attacks

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Security Best Practices](https://tools.ietf.org/html/rfc8725)

---

## ✅ Quick Security Audit Checklist

Run this before deploying:

```bash
# Check for vulnerabilities
npm audit

# Check for secrets in code
git secrets --scan

# Test authentication
# - Try accessing protected routes without token
# - Try with expired token
# - Try with invalid token

# Test rate limiting
# - Send 100 requests quickly
# - Verify 429 Too Many Requests response

# Test input validation
# - Send malformed JSON
# - Send SQL injection strings
# - Send XSS payloads

# Test CORS
# - Try requests from unauthorized origin
# - Verify credentials blocked for wrong origin
```
---

## 🆕 Recent Security Updates (December 2025)

### ✅ Implemented Features
1. **OAuth 2.0 Integration**
   - Google Sign-In with backend token verification
   - Discord OAuth with secure callback handling
   - Automatic account linking with existing emails
   - OAuth provider validation to prevent account hijacking

2. **Enhanced Password Security**
   - Real-time password strength validation with visual feedback
   - Password visibility toggle in all password fields
   - Current password verification required for password changes
   - OAuth accounts protected from password change attempts
   - Pre-save hook prevents double hashing

3. **Cloudflare Turnstile CAPTCHA**
   - CAPTCHA required on login and signup forms
   - Server-side verification with Cloudflare API
   - User-friendly error handling and retry mechanism

4. **Profile Management Enhancements**
   - Comprehensive profile editing (name, email, password)
   - Account deletion with confirmation dialog
   - Budget and user type configuration
   - Conditional UI rendering based on auth provider

5. **User Experience Improvements**
   - Server health checks with auto-retry (30s backend, 45s ML server)
   - Loading states during CAPTCHA verification
   - Toast notifications for all security-related actions
   - Password requirements checklist on signup and profile update

### 🔒 Security Best Practices Implemented
- Password field always excluded from user queries (select: false)
- OAuth provider stored and validated on all operations
- Email uniqueness enforced across all auth methods
- Current password verification prevents unauthorized changes
- Account deletion cascades to remove all user data

---

**Last Updated**: December 9, 2025
**Security Contact**: sumeetdutta040@gmail.com
