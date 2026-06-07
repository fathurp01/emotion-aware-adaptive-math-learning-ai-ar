# Setup Instructions

## Prerequisites

Before starting, ensure you have installed:

- **Node.js** 18.x or higher
- **Recommended:** Node.js **20 LTS** (more stable for Next.js 14 on Windows)
- **MySQL** 8.0 or higher
- **Git** (for version control)
- **AI API Key** (at least one):
   - **Gemini API Key** (free from [ai.google.dev](https://ai.google.dev))
   - **Mistral API Key** (from [console.mistral.ai](https://console.mistral.ai))

## Step-by-Step Installation

> Note (Windows): If `npm run dev`/`next dev` shows filesystem errors like `UNKNOWN ... open .next\\static\\chunks\\webpack.js` or `EPERM`, this usually happens on newer Node versions (e.g., 22.x) or because `.next` file is locked (antivirus / other Node process). Safest to use Node **20 LTS** and ensure no other `node.exe` processes are running.

If you cannot change Node version, try running dev server with Turbopack:

```bash
npm run dev:turbo
```

### Workflow notes (important on Windows)

- Run dev server (`npm run dev` / `npm run dev:turbo`) in a **dedicated terminal** and leave it running.
- For one-off commands (e.g. `npm run db:push`, `npm run precompute-materials`, or `Invoke-WebRequest`), use a **new terminal**.

If those commands are run in the same terminal as dev server, server process might stop/interrupt and trigger filesystem errors like `.next\\static\\chunks\\...`.

### 1. Install Dependencies

```bash
npm install
```

This will install 536 packages including:
- Next.js 14.2.18
- React 18.3.1
- TensorFlow.js 4.22.0
- Prisma 5.22.0
- Google Generative AI
- And other dependencies

### 2. Setup Environment Variables

Create `.env` file in root folder:

```env
DATABASE_URL="mysql://root:your_password@localhost:3306/emotion_learning_db"
GEMINI_API_KEY="your_gemini_api_key_here"
MISTRAL_API_KEY="your_mistral_api_key_here"

# Authentication secret (required for production builds)
# Use AUTH_SECRET (recommended). JWT_SECRET/NEXTAUTH_SECRET are accepted as fallback.
AUTH_SECRET="random_secret_key_min_32_characters"
```

Notes:
- You only need to fill **one**: `GEMINI_API_KEY` or `MISTRAL_API_KEY`.
- If Gemini is missing or rate-limited, system automatically falls back to Mistral (if `MISTRAL_API_KEY` is set).

**How to get Gemini API Key:**
1. Visit [https://ai.google.dev](https://ai.google.dev)
2. Click "Get API Key"
3. Login with Google account
4. Generate API key (free)
5. Copy to `.env` file

**Generate AUTH_SECRET (recommended):**
```bash
# In terminal/PowerShell:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### 3. Setup MySQL Database

**Open MySQL:**
```bash
mysql -u root -p
```

**Create database:**
```sql
CREATE DATABASE emotion_learning_db;
EXIT;
```

### 4. Generate Prisma Client & Push Schema

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database
npm run db:push
```

This command will create 5 tables:
- `User` (students & teachers)
- `Chapter` (learning chapters)
- `Material` (learning materials)
- `QuizLog` (quiz results)
- `EmotionLog` (emotion detection logs)

### 5. Seed Sample Data (IMPORTANT!)

```bash
npm run db:seed
```

This will create:
- 2 demo users (teacher & student)
- 2 chapters (Basic Algebra, Geometry)
- 3 materials (Linear Equation, System of Equations, Circle)

**Demo accounts created:**
- Teacher: `teacher@demo.com` / `password123`
- Student: `student@demo.com` / `password123`

### 6. Prepare Emotion Detection Model

Frontend system uses TensorFlow.js for emotion classification.

**Default path (without extra config):**
- `public/model/tfjs_model/model.json`
- `public/model/tfjs_model/metadata.json` (containing `labels: string[]`)

**Configuration (for MobileNetV2 model from transfer learning / fine-tuning):**
Add the following env variables (optional):

```env
# URL/path TFJS model.json (GraphModel or LayersModel)
NEXT_PUBLIC_EMOTION_MODEL_URL=/model/tfjs_model/model.json

# URL/path metadata.json containing labels
NEXT_PUBLIC_EMOTION_METADATA_URL=/model/tfjs_model/metadata.json

# If metadata.json is missing, can set labels via env (comma-separated)
NEXT_PUBLIC_EMOTION_LABELS=Negative,Neutral,Positive

# Optional: override MediaPipe wasm location (if self-hosting)
# NEXT_PUBLIC_MEDIAPIPE_WASM_BASE_URL=https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm

# Optional: override MediaPipe .task model (if self-hosting/offline)
# NEXT_PUBLIC_MEDIAPIPE_FACE_LANDMARKER_MODEL_URL=/mediapipe/face_landmarker.task
```

Notes:
- Model will try to load as GraphModel first, then fallback to LayersModel.
- If model is not found / load error, system automatically falls back to MediaPipe (lower accuracy, heuristic blendshapes based).

**Option B: Train your own model**
1. Visit [Teachable Machine](https://teachablemachine.withgoogle.com/)
2. Choose "Image Project" → "Standard image model"
3. Create 5 classes: Happy, Sad, Angry, Anxious, Neutral
4. Upload face images for each emotion (at least 50 per class)
5. Train model
6. Export → "TensorFlow.js" → "Download"
7. Extract to `public/model/` and ensure filenames match default (or use env URL above)

### 7. Run Development Server

```bash
npm run dev
```

Server will run at [http://localhost:3000](http://localhost:3000)

## Verification Checklist

After setup, check if everything runs:

- [ ] npm install successful (536 packages)
- [ ] `.env` file created with 3 variables
- [ ] MySQL database `emotion_learning_db` exists
- [ ] `npm run db:push` success (5 tables created)
- [ ] `npm run db:seed` success (demo data inserted)
- [ ] `public/model/` folder exists and contains 3 files
- [ ] `npm run dev` runs without error
- [ ] Can open [http://localhost:3000](http://localhost:3000)
- [ ] Can login with `student@demo.com` / `password123`

## Troubleshooting Common Issues

### Error: "Cannot find module @prisma/client"
```bash
npm run db:generate
```

### Error: "P1001: Can't reach database server"
- Ensure MySQL is running
- Check username/password in `DATABASE_URL`
- Check port (default: 3306)

### Error: "GEMINI_API_KEY is not defined"
- Check `.env` file exists in root folder
- Ensure variable is written exactly: `GEMINI_API_KEY=...`
- Restart dev server after editing `.env`

### Error: "MISTRAL_API_KEY is not defined" / fallback not working
- Ensure `MISTRAL_API_KEY` is in `.env`
- Restart dev server after editing `.env`

### Error Windows: `UNKNOWN ... open .next\\static\\chunks\\app\\layout.js`
This is usually because `.next` file is locked / antivirus scan / Node version too new.

Quick solution:
```bash
npm run clean
npm run dev
```

If it still appears:
- Try `npm run dev:turbo`
- Use Node **20 LTS** (most stable for Next.js 14 on Windows)
- Move project to a shorter path (e.g. `D:\Src\ai\project`)
- Add project folder to antivirus/Defender exclusion

### Camera not appearing
- Allow browser camera permission
- Use Chrome/Edge (better webcam support)
- Check `public/model/` folder exists and is complete

### Error during npm install
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

## Next Steps

After setup is successful:

1. **Login as Student** → Test emotion detection
2. **Complete onboarding** → Fill learning style questionnaire
3. **Open material** → Watch adaptive UI change with emotion
4. **Try quiz** → Chat with AI
5. **Login as Teacher** → View student analytics

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

To deploy to production:

1. **Setup production database** (MySQL in cloud)
2. **Update `.env` with production values**
3. **Build application:**
   ```bash
   npm run build
   ```
4. **Run production server:**
   ```bash
   npm start
   ```

**Hosting recommendations:**
- Frontend: Vercel (optimized for Next.js)
- Database: PlanetScale, Railway, or AWS RDS
- Alternative: Deploy all-in-one on VPS (DigitalOcean, Linode)

## Need Help?

If experiencing issues during setup:

1. Check error message in terminal
2. Check browser console (F12)
3. See troubleshooting above
4. Check documentation in `README.md`
5. Review `IMPLEMENTATION_SUMMARY.md` for architecture

---

**Happy Coding! 🚀**
