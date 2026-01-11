# Deployment Guide

## Production Deployment Options

### Option 1: Vercel (Recommended) ⭐

Vercel adalah platform terbaik untuk Next.js karena dibuat oleh team yang sama.

#### Prerequisites:
- Vercel account (gratis)
- GitHub/GitLab account
- Cloud MySQL database (PlanetScale, Railway, atau AWS RDS)

#### Steps:

**1. Prepare Production Database**

Pilihan A: PlanetScale (Recommended)
```bash
# 1. Sign up: https://planetscale.com
# 2. Create new database: "emotion-learning-prod"
# 3. Copy connection string
```

Pilihan B: Railway
```bash
# 1. Sign up: https://railway.app
# 2. New Project → Add MySQL
# 3. Copy DATABASE_URL from variables
```

**2. Push Code to GitHub**
```bash
git init
git add .
git commit -m "Initial commit - Emotion Learning System"
git branch -M main
git remote add origin https://github.com/yourusername/emotion-learning.git
git push -u origin main
```

**3. Deploy to Vercel**

Via Web UI:
1. Go to https://vercel.com
2. Click "Import Project"
3. Connect GitHub → Select repository
4. Configure:
   - Framework Preset: Next.js
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

**4. Add Environment Variables**

In Vercel dashboard → Settings → Environment Variables:

```env
DATABASE_URL=mysql://user:password@host:3306/dbname
GEMINI_API_KEY=AIzaSy...
NEXTAUTH_SECRET=your_production_secret_32chars
```

**Important:** Click "Add" for each variable for all environments (Production, Preview, Development)

**5. Run Database Migrations**

In Vercel dashboard → Settings → General → Enable:
- Build Command: `npx prisma generate && npx prisma db push && npm run build`

Or manually via CLI:
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Run migrations
vercel env pull .env.production
npx prisma db push
```

**6. Seed Production Database**

Option A: Via local connection
```bash
# Use production DATABASE_URL
DATABASE_URL="mysql://prod_connection_string" npx tsx prisma/seed.ts
```

Option B: Via Vercel CLI
```bash
vercel env pull
npx tsx prisma/seed.ts
```

**7. Upload Model Files**

Vercel supports static files in `public/`:
1. Commit model files to git:
   ```bash
   git add public/model/
   git commit -m "Add emotion detection model"
   git push
   ```
2. Vercel will automatically serve from `/model/tfjs_model/model.json`

**8. Verify Deployment**

Visit: `https://your-project.vercel.app`

Test checklist:
- [ ] Landing page loads
- [ ] Can login with demo account
- [ ] Camera permission works (HTTPS required)
- [ ] Emotion detection runs
- [ ] Quiz generates (Gemini API works)
- [ ] Database connections work

---

### Option 2: Railway

Railway supports full-stack deployment dengan database included.

#### Steps:

**1. Install Railway CLI**
```bash
npm i -g @railway/cli
```

**2. Login & Initialize**
```bash
railway login
railway init
```

**3. Add MySQL Service**
```bash
railway add --database mysql
```

**4. Configure Environment**
```bash
# Railway auto-generates DATABASE_URL
railway variables set GEMINI_API_KEY="your_key"
railway variables set NEXTAUTH_SECRET="your_secret"
```

**5. Deploy**
```bash
railway up
```

**6. Run Migrations**
```bash
railway run npx prisma db push
railway run npx tsx prisma/seed.ts
```

**7. Get Public URL**
```bash
railway domain
```

---

### Option 3: VPS (Digital Ocean, Linode, AWS EC2)

For full control, deploy to your own server.

#### Prerequisites:
- Ubuntu 20.04+ VPS
- Minimum specs: 2GB RAM, 2 CPU cores
- SSH access

#### Steps:

**1. Connect to Server**
```bash
ssh root@your_server_ip
```

**2. Install Dependencies**
```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install MySQL
apt install -y mysql-server
mysql_secure_installation

# Install PM2 (process manager)
npm install -g pm2
```

**3. Setup MySQL**
```bash
mysql -u root -p

CREATE DATABASE emotion_learning_db;
CREATE USER 'app_user'@'localhost' IDENTIFIED BY 'strong_password';
GRANT ALL PRIVILEGES ON emotion_learning_db.* TO 'app_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

**4. Clone Project**
```bash
cd /var/www
git clone https://github.com/yourusername/emotion-learning.git
cd emotion-learning
```

**5. Install & Build**
```bash
npm install
npm run build
```

**6. Configure Environment**
```bash
nano .env
```

Add:
```env
DATABASE_URL="mysql://app_user:strong_password@localhost:3306/emotion_learning_db"
GEMINI_API_KEY="your_key"
NEXTAUTH_SECRET="your_secret"
NODE_ENV=production
```

**7. Run Migrations**
```bash
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

**8. Start with PM2**
```bash
pm2 start npm --name "emotion-learning" -- start
pm2 save
pm2 startup
```

**9. Setup Nginx Reverse Proxy**
```bash
apt install -y nginx

nano /etc/nginx/sites-available/emotion-learning
```

Add:
```nginx
server {
    listen 80;
    server_name your_domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/emotion-learning /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

**10. SSL Certificate (HTTPS)**
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your_domain.com
```

---

## Post-Deployment Configuration

### 1. Database Optimization

For production, add indexes:
```sql
ALTER TABLE EmotionLog ADD INDEX idx_userId_createdAt (userId, createdAt);
ALTER TABLE QuizLog ADD INDEX idx_userId_materialId (userId, materialId);
ALTER TABLE Material ADD INDEX idx_chapterId (chapterId);
```

### 2. Security Hardening

**Update next.config.js:**
```javascript
module.exports = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ],
      },
    ]
  },
}
```

**Environment variables:**
```env
# Never commit these to git!
DATABASE_URL=
GEMINI_API_KEY=
NEXTAUTH_SECRET=
NODE_ENV=production
```

### 3. Monitoring & Logging

**Add Sentry for error tracking:**
```bash
npm install @sentry/nextjs
```

**Configure sentry.config.js:**
```javascript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

**Add logging service:**
- Vercel: Built-in logs in dashboard
- VPS: Use PM2 logs + Logrotate

### 4. Performance Optimization

**Enable caching:**
```javascript
// In API routes
export const revalidate = 60; // Revalidate every 60 seconds
```

**Optimize images:**
```javascript
// next.config.js
images: {
  domains: ['your-cdn-domain.com'],
  formats: ['image/avif', 'image/webp'],
}
```

**Database connection pooling:**
```javascript
// lib/db.ts
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});
```

---

## Backup Strategy

### 1. Database Backup (Daily)

**Automated script:**
```bash
#!/bin/bash
# backup-db.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/mysql"
DB_NAME="emotion_learning_db"
DB_USER="app_user"
DB_PASS="your_password"

mkdir -p $BACKUP_DIR

mysqldump -u $DB_USER -p$DB_PASS $DB_NAME | gzip > $BACKUP_DIR/backup_$DATE.sql.gz

# Keep only last 7 days
find $BACKUP_DIR -type f -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: backup_$DATE.sql.gz"
```

**Setup cron job:**
```bash
crontab -e
```

Add:
```
0 2 * * * /path/to/backup-db.sh
```

### 2. File Backup

**Backup uploads folder:**
```bash
tar -czf uploads_backup.tar.gz public/uploads/
```

### 3. Cloud Storage

Upload backups to S3/Google Cloud Storage:
```bash
aws s3 cp backup.sql.gz s3://your-bucket/backups/
```

---

## Monitoring Checklist

After deployment, monitor:

- [ ] **Uptime:** Use UptimeRobot or Pingdom
- [ ] **Error rates:** Check Sentry dashboard
- [ ] **API response times:** < 500ms for most endpoints
- [ ] **Database queries:** Optimize slow queries (> 100ms)
- [ ] **Disk space:** Especially for uploaded images
- [ ] **SSL certificate:** Renew before expiry
- [ ] **Dependencies:** Run `npm audit` monthly

---

## Rollback Plan

If deployment fails:

**Vercel:**
```bash
# Rollback to previous deployment
vercel rollback
```

**VPS:**
```bash
# Restore previous version
cd /var/www/emotion-learning
git log --oneline -10  # Find previous commit
git checkout <commit-hash>
pm2 restart emotion-learning
```

**Database:**
```bash
# Restore from backup
gunzip backup_20240101.sql.gz
mysql -u app_user -p emotion_learning_db < backup_20240101.sql
```

---

## Production Checklist

Before going live:

- [ ] All environment variables set correctly
- [ ] Database migrations run successfully
- [ ] Demo accounts created (for testing)
- [ ] SSL certificate installed (HTTPS)
- [ ] Backups configured (daily)
- [ ] Monitoring set up (Sentry, Uptime)
- [ ] Error pages customized (404, 500)
- [ ] SEO meta tags added
- [ ] Analytics integrated (optional)
- [ ] CORS configured if needed
- [ ] Rate limiting enabled for APIs
- [ ] Documentation updated with production URLs
- [ ] Load testing completed
- [ ] Security audit passed

---

## Maintenance Schedule

**Weekly:**
- Check error logs
- Review slow queries
- Monitor disk space

**Monthly:**
- Update dependencies: `npm update`
- Security audit: `npm audit fix`
- Review analytics

**Quarterly:**
- Database optimization
- Backup restore test
- Performance review

---

## Support Contacts

Production issues:
- **Hosting:** Check provider's support
- **Database:** Check DB provider's docs
- **Next.js:** https://nextjs.org/docs
- **Gemini API:** https://ai.google.dev/support

---

**Good luck with your deployment! 🚀**
