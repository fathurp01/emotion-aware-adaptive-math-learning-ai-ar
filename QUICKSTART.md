# Quick Start Guide

## Langkah Cepat (15 menit)

### 1. Install (2 menit)
```bash
npm install
```

### 2. Setup Database (3 menit)
```bash
# Buat database MySQL
mysql -u root -p
CREATE DATABASE emotion_learning_db;
EXIT;

# Push schema
npm run db:generate
npm run db:push
npm run db:seed
```

### 3. Configure Environment (2 menit)
Buat file `.env`:
```env
DATABASE_URL="mysql://root:password@localhost:3306/emotion_learning_db"
# Provide at least ONE provider
GEMINI_API_KEY="your_key_from_ai.google.dev"
# or
MISTRAL_API_KEY="your_key_from_console.mistral.ai"
NEXTAUTH_SECRET="random_string_min_32_chars"
```

### 4. Add Model Files (5 menit)
Download atau train model di [Teachable Machine](https://teachablemachine.withgoogle.com/)

Copy 3 files ke `public/model/`:
- model.json
- model_metadata.json
- weights.bin

### 5. Run (1 menit)
```bash
npm run dev
```

Open: http://localhost:3000

### 6. Test (2 menit)
Login dengan:
- Student: `student@demo.com` / `password123`
- Teacher: `teacher@demo.com` / `password123`

---

## Demo Flow

### As Student:
1. Login → Onboarding (isi 12 pertanyaan)
2. Dashboard → Klik material
3. **Aktifkan kamera** → Lihat UI berubah sesuai emosi
4. Klik "Quiz" → Chat dengan AI
5. Cek emotion stats di dashboard

### As Teacher:
1. Login → Dashboard
2. Lihat list students (red badge = high anxiety)
3. Create Material → Upload konten baru
4. Monitor student well-being

---

## File yang Harus Ada

✅ Sudah dibuat:
- [x] 35+ application files
- [x] Database schema
- [x] Seed data

⚠️ Harus ditambahkan:
- [ ] `public/model/tfjs_model/model.json`
- [ ] `public/model/tfjs_model/metadata.json`
- [ ] `public/model/tfjs_model/group1-shard*.bin`
- [ ] `.env` file dengan credentials

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build production
npm start                # Run production

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to MySQL
npm run db:seed          # Insert demo data
npm run db:studio        # Open Prisma Studio GUI

# Code Quality
npm run lint             # Run ESLint
```

---

## Troubleshooting in 1 Minute

**Camera not working?**
```
1. Check browser permissions
2. Use Chrome/Edge
3. Verify model files in public/model/
```

**Database error?**
```
1. Check MySQL is running: `mysql -u root -p`
2. Verify DATABASE_URL in .env
3. Run: npm run db:generate
```

**Quiz not generating?**
```
1. Check GEMINI_API_KEY or MISTRAL_API_KEY in .env
2. Get free key: https://ai.google.dev
3. Restart dev server
```

**Cannot find module?**
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## Architecture (1 Diagram)

```
┌─────────────┐
│   Browser   │
│  (Webcam)   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│  Emotion Detection  │ ← TensorFlow.js
│   (Client-side)     │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Fuzzy Logic ES    │ ← 7 Rules
│  (Expert System)    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│   Adaptive UI       │ ← Background, Hints, Support
│  (Real-time)        │
└─────────────────────┘

┌─────────────┐
│  Material   │
│   Content   │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ Gemini/Mistral AI   │ ← Quiz Generation
│  (Server-side)      │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Quiz + Feedback    │ ← Personalized
│  (Chat Interface)   │
└─────────────────────┘
```

---

## Tech Stack (Quick Reference)

| Category | Technology |
|----------|-----------|
| **Frontend** | Next.js 14, React 18, TypeScript |
| **Styling** | Tailwind CSS |
| **Database** | MySQL 8.0, Prisma ORM |
| **State** | Zustand (with persist) |
| **AI - Vision** | TensorFlow.js 4.22 |
| **AI - Language** | Gemini (primary) + Mistral (fallback) |


| **Expert System** | Custom Fuzzy Logic (7 rules) |
| **Auth** | bcrypt password hashing |
| **Validation** | Zod |

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Student | student@demo.com | password123 |
| Teacher | teacher@demo.com | password123 |

---

## Next Steps

1. ✅ Setup complete → Start development server
2. ✅ Test basic features → Login, dashboard, camera
3. ✅ Test adaptive UI → Watch background change with emotion
4. ✅ Test AI quiz → Chat with Gemini
5. ✅ Test teacher portal → Create materials, monitor students

---

**Need detailed guide?** → See `SETUP.md`

**Need architecture info?** → See `IMPLEMENTATION_SUMMARY.md`

**Having issues?** → Check troubleshooting sections above
