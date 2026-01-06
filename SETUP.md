# Setup Instructions

## Prerequisites

Sebelum memulai, pastikan sudah menginstall:

- **Node.js** 18.x atau lebih tinggi
- **MySQL** 8.0 atau lebih tinggi
- **Git** (untuk version control)
- **Google Gemini API Key** (gratis dari [ai.google.dev](https://ai.google.dev))

## Step-by-Step Installation

### 1. Install Dependencies

```bash
npm install
```

Ini akan menginstall 536 packages termasuk:
- Next.js 14.2.18
- React 18.3.1
- TensorFlow.js 4.22.0
- Prisma 5.22.0
- Google Generative AI
- Dan dependencies lainnya

### 2. Setup Environment Variables

Buat file `.env` di root folder:

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/emotion_learning_db"
GEMINI_API_KEY="your_gemini_api_key_here"
NEXTAUTH_SECRET="random_secret_key_min_32_characters"
```

**Cara mendapatkan Gemini API Key:**
1. Kunjungi [https://ai.google.dev](https://ai.google.dev)
2. Klik "Get API Key"
3. Login dengan Google account
4. Generate API key (gratis)
5. Copy ke `.env` file

**Generate NEXTAUTH_SECRET:**
```bash
# Di terminal/PowerShell:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Setup MySQL Database

**Buka MySQL:**
```bash
mysql -u root -p
```

**Buat database:**
```sql
CREATE DATABASE emotion_learning_db;
EXIT;
```

### 4. Generate Prisma Client & Push Schema

```bash
# Generate Prisma Client
npm run db:generate

# Push schema ke database
npm run db:push
```

Perintah ini akan membuat 5 tabel:
- `User` (students & teachers)
- `Chapter` (bab pembelajaran)
- `Material` (materi pembelajaran)
- `QuizLog` (hasil quiz)
- `EmotionLog` (log deteksi emosi)

### 5. Seed Sample Data (PENTING!)

```bash
npm run db:seed
```

Ini akan membuat:
- 2 demo users (teacher & student)
- 2 chapters (Aljabar Dasar, Geometri)
- 3 materials (Persamaan Linear, Sistem Persamaan, Lingkaran)

**Demo accounts yang dibuat:**
- Teacher: `teacher@demo.com` / `password123`
- Student: `student@demo.com` / `password123`

### 6. Prepare Emotion Detection Model

**Opsi A: Gunakan model yang sudah ada (recommended)**
1. Download model dari [link ini - jika tersedia]
2. Extract dan copy ke folder `public/model/`
3. Pastikan ada 3 files:
   - `model.json`
   - `model_metadata.json`
   - `weights.bin`

**Opsi B: Train model sendiri**
1. Kunjungi [Teachable Machine](https://teachablemachine.withgoogle.com/)
2. Pilih "Image Project" → "Standard image model"
3. Buat 5 classes: Happy, Sad, Angry, Anxious, Neutral
4. Upload gambar wajah untuk setiap emosi (minimal 50 per class)
5. Train model
6. Export → "TensorFlow.js" → "Download"
7. Extract ke `public/model/`

### 7. Run Development Server

```bash
npm run dev
```

Server akan berjalan di [http://localhost:3000](http://localhost:3000)

## Verification Checklist

Setelah setup, cek apakah semua berjalan:

- [ ] npm install berhasil (536 packages)
- [ ] `.env` file sudah dibuat dengan 3 variabel
- [ ] MySQL database `emotion_learning_db` sudah ada
- [ ] `npm run db:push` sukses (5 tabel terbuat)
- [ ] `npm run db:seed` sukses (demo data masuk)
- [ ] Folder `public/model/` ada dan berisi 3 files
- [ ] `npm run dev` jalan tanpa error
- [ ] Bisa buka [http://localhost:3000](http://localhost:3000)
- [ ] Bisa login dengan `student@demo.com` / `password123`

## Troubleshooting Common Issues

### Error: "Cannot find module @prisma/client"
```bash
npm run db:generate
```

### Error: "P1001: Can't reach database server"
- Pastikan MySQL sudah running
- Cek username/password di `DATABASE_URL`
- Cek port (default: 3306)

### Error: "GEMINI_API_KEY is not defined"
- Cek file `.env` ada di root folder
- Pastikan variabel ditulis persis: `GEMINI_API_KEY=...`
- Restart dev server setelah edit `.env`

### Camera tidak muncul
- Allow browser camera permission
- Gunakan Chrome/Edge (webcam support lebih baik)
- Cek folder `public/model/` ada dan lengkap

### Error saat npm install
```bash
# Clear cache dan reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## Next Steps

Setelah setup berhasil:

1. **Login sebagai Student** → Test emotion detection
2. **Complete onboarding** → Isi questionnaire gaya belajar
3. **Buka materi** → Lihat adaptive UI berubah sesuai emosi
4. **Coba quiz** → Chat dengan AI
5. **Login sebagai Teacher** → Lihat student analytics

## Development Commands

```bash
# Run dev server
npm run dev

# Build for production
npm run build
npm start

# Database management
npm run db:studio      # Open Prisma Studio (GUI)
npm run db:generate    # Regenerate Prisma Client
npm run db:push        # Push schema changes

# Code quality
npm run lint          # Run ESLint
```

## Production Deployment

Untuk deploy ke production:

1. **Setup production database** (MySQL di cloud)
2. **Update `.env` dengan production values**
3. **Build aplikasi:**
   ```bash
   npm run build
   ```
4. **Run production server:**
   ```bash
   npm start
   ```

**Rekomendasi hosting:**
- Frontend: Vercel (optimized untuk Next.js)
- Database: PlanetScale, Railway, atau AWS RDS
- Alternative: Deploy all-in-one di VPS (DigitalOcean, Linode)

## Need Help?

Jika mengalami masalah saat setup:

1. Cek error message di terminal
2. Cek console browser (F12)
3. Lihat troubleshooting di atas
4. Cek dokumentasi di `README.md`
5. Review file `IMPLEMENTATION_SUMMARY.md` untuk architecture

---

**Happy Coding! 🚀**
