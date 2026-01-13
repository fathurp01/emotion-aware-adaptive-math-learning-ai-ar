# Emotion-Aware Adaptive Learning System

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=next.js&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white)
![TensorFlow](https://img.shields.io/badge/TensorFlow.js-FF6F00?style=for-the-badge&logo=tensorflow&logoColor=white)

## 📚 Overview

An intelligent learning platform that adapts to students' emotional states in real-time using AI-powered emotion detection and expert system fuzzy logic. Built for a final year thesis project.

### Key Features

- 🎭 **Real-time Emotion Detection** - Uses webcam and TensorFlow.js for continuous emotion monitoring
- 🧠 **Fuzzy Logic Expert System** - Adapts UI and content based on emotional state
- 🤖 **AI-Powered Quiz Generation** - Gemini (primary) with automatic Mistral fallback
- 📊 **Learning Style Adaptation** - Visual, Auditory, or Kinesthetic preference detection
- 👩‍🏫 **Teacher Dashboard** - Monitor student well-being and anxiety patterns
- 📈 **Analytics & Insights** - Track emotional trends and learning progress
- 🧮 **Readable Math Materials** - Markdown + LaTeX rendered via KaTeX

## 🏗️ Architecture

### Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** MySQL (Local)
- **AI/ML:**
  - Client-side: TensorFlow.js + Teachable Machine
  - Server-side: Gemini (primary) + Mistral (fallback)
- **State Management:** Zustand
- **Validation:** Zod

### System Actors

1. **Students (Murid)**
   - Complete learning style questionnaire
   - View adaptive learning materials
   - Take AI-generated quizzes
   - Track emotional journey

2. **Teachers**
   - Create/manage content (CMS)
   - Monitor student anxiety patterns
   - View class performance analytics

## 🚀 Getting Started

### Prerequisites

- Node.js **18+** (recommended: **Node 20 LTS** for Windows + Next.js 14 stability)
- MySQL **8.0+**
- AI API Key (at least one):
  - Gemini: https://ai.google.dev
  - Mistral: https://console.mistral.ai

### Quick Setup (Local)

1) Install dependencies

```bash
npm install
```

2) Configure environment

```bash
# Windows PowerShell
Copy-Item .env.example .env
```

Edit `.env`:

```env
DATABASE_URL="mysql://root:password@localhost:3306/emotion_learning_db"

# Provide at least ONE provider
GEMINI_API_KEY="your_key_from_ai.google.dev"
# or
MISTRAL_API_KEY="your_key_from_console.mistral.ai"

NEXTAUTH_SECRET="random_string_min_32_chars"

# Recommended (new auth cookie signing secret)
AUTH_SECRET="random_string_min_32_chars"
```

Notes:
- If Gemini is missing/rate-limited, the app falls back to Mistral when `MISTRAL_API_KEY` is set.
- Generate a secret quickly:
  - `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

3) Setup database schema + seed

```bash
npm run db:generate
npm run db:push
npm run db:seed
```

4) Add emotion model files

This project expects TFJS model assets under:

- `public/model/tfjs_model/model.json`
- `public/model/tfjs_model/metadata.json`
- `public/model/tfjs_model/*.bin` (shards)

If the TFJS model fails to load, the app can fallback to MediaPipe-based heuristic emotion signals (lower accuracy).

5) Run the dev server

```bash
npm run dev
```

Open http://localhost:3000

Windows tip:
- If you hit `.next` file lock errors, run:
  - `npm run clean`
  - then `npm run dev` (or `npm run dev:turbo`)

For full setup details, see [SETUP.md](SETUP.md).

## 🧾 Material Pre-generation (Global)

This project can refine material content once and persist it to the DB so all users see the same finalized content.

- Run manually: `npm run precompute-materials`
- Or enable at startup via `.env`:
  - `MATERIAL_PRECOMPUTE_ON_STARTUP=1`
  - `MATERIAL_PRECOMPUTE_LIMIT=...`
  - `MATERIAL_PRECOMPUTE_FORCE=1` (optional)
  - `MATERIAL_REFINE_MAX_OUTPUT_TOKENS=1536` (longer output)

### Manual Health Check (Optional)

```bash
npm run health-check
```

## 📁 Project Structure

```
├── app/
│   ├── api/                    # API Routes
│   │   ├── quiz/
│   │   │   ├── generate/       # AI quiz generation
│   │   │   └── feedback/       # AI feedback
│   │   ├── student/
│   │   │   ├── log-emotion/    # Emotion logging
│   │   │   ├── onboarding/     # Learning style setup
│   │   │   └── material/       # Material API
│   │   └── teacher/            # Teacher APIs
│   ├── student/                # Student Portal
│   │   ├── dashboard/
│   │   ├── learn/[materialId]/ # Adaptive learning page
│   │   ├── quiz/[materialId]/
│   │   └── onboarding/
│   └── teacher/                # Teacher Portal
│       ├── dashboard/
│       └── materials/
├── components/
│   ├── ai/
│   │   └── EmotionCamera.tsx   # Webcam emotion detection
│   ├── ui/
│   │   └── AdaptiveText.tsx    # Emotion-adaptive content
│   └── layout/
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── store.ts                # Zustand state management
│   └── gemini.ts               # Google AI integration
├── utils/
│   ├── fuzzyLogic.ts           # Expert system logic
│   └── learningStyleAlgo.ts    # VARK questionnaire
├── prisma/
│   └── schema.prisma           # Database schema
└── public/
    └── model/                  # TensorFlow.js model files
```

## 🧪 Key Components Explained

### 1. Emotion Detection (`EmotionCamera.tsx`)

```typescript
// Real-time emotion detection using Teachable Machine
<EmotionCamera 
  userId={user.id}
  materialId={currentMaterial.id}
  autoLog={true}
  showVideo={false}  // Privacy mode
/>
```

**Emotions Detected:**
- Neutral, Happy, Anxious, Confused, Frustrated, Sad, Surprised

### 2. Fuzzy Logic Expert System (`fuzzyLogic.ts`)

**Input Variables:**
- Emotion state (fuzzified)
- Quiz performance score
- Confidence level

**Output Adaptations:**
- UI Theme (CALM, DEFAULT, ENERGETIC)
- Show hints
- Simplify text
- Difficulty adjustment
- Background colors
- Breathing exercises

**Example Rule:**
```
IF student is Anxious AND confidence > 0.6
THEN
  - Use CALM theme (blue background)
  - Show hints
  - Simplify text
  - Trigger breathing exercise
  - Lower difficulty
```

### 3. AI Quiz Generation (`gemini.ts`)

```typescript
// Generate adaptive quiz based on emotion + learning style
const quiz = await generateQuiz(
  materialContent,
  'Anxious',      // Current emotion
  'VISUAL'        // Learning style
);

// Output:
{
  question: "...",
  hint: "Take your time...",  // For anxious students
  difficulty: "EASY",
  supportiveMessage: "You're doing great!"
}
```

### 4. Learning Style Algorithm (`learningStyleAlgo.ts`)

12-question VARK assessment determines:
- **VISUAL** - Prefers diagrams, charts, images
- **AUDITORY** - Prefers verbal explanations, discussions
- **KINESTHETIC** - Prefers hands-on practice, doing

## 🎯 Core Workflows

### Student Learning Flow

1. **Onboarding** → Complete questionnaire → Learning style determined
2. **Browse Materials** → Select chapter/material
3. **Adaptive Learning** → Camera activates → Emotion detected → UI adapts
4. **Take Quiz** → AI generates personalized questions → Submit answers → Get feedback
5. **View Progress** → Dashboard shows emotion history & performance

## ✅ UAS 5-Step Requirement Mapping (SC-5/SC-6)

This section maps the system to the UAS requirements (1)–(5).

1) Student views material (content adaptive)
- Implemented in the Student Learn page: `/student/learn/[materialId]`.
- Content-adaptive is implemented via **personalized remedial content per user+material**, generated and persisted based on feedback.

2) Seek feedback (emotion or understanding level)
- Emotion feedback: webcam + TFJS model logs via `/api/student/log-emotion`.
- Understanding feedback: quiz + scoring via `/student/quiz/[materialId]` and `/api/quiz/*`.

3) Identification/classification of feedback
- Emotion label normalized to `Negative|Neutral|Positive`.
- Quiz performance graded (recap + calc) and logged to DB.
- Expert System (Fuzzy Logic) classifies inputs into UI adaptations and difficulty adjustments.

4) Update material based on feedback using AI
- Implemented as **AI-generated personalized remedial content**, persisted per user+material and shown on the learn page.
- The material update is not destructive to the base material (safer for multi-user), but provides a personalized updated version for each student.

5) Repeat (1)–(4) until understood
- Quiz uses mastery stop-condition (e.g., correct streak) with a max cap.
- When a student struggles, the system auto-generates/upserts remedial material for the next learning loop.

Minimal interface requirement: this project runs in VS Code (local) and can also be demonstrated via browser.

## 🧪 Validation (Build + Feature Checks)

### 1) Build & Lint

```bash
npm run build
npm run lint
```

### 2) Health Check

```bash
npm run health-check
```

Also verify:
- `GET /api/health` returns `healthy` or `degraded`.

### 3) DB Validation

Run:

```bash
npm run db:generate
npm run db:push
```

Confirm tables exist (at minimum):
- `User`, `Material`, `QuizLog`, `EmotionLog`, `RemedialMaterial`

### 4) Demo Validation Script (UAS)

As Student:
1. Login (demo user) → complete onboarding.
2. Open a material → allow camera → observe emotion indicator.
3. Take quiz → answer wrong a few times → system logs quiz + generates remedial.
4. Back to learn page → see “Remedial Material (Personal)” updated.
5. Retake quiz → reach mastery (finish reason shown).

As Teacher:
1. Login teacher → dashboard → observe student anxiety pattern summaries.

## 📖 Additional Docs

- Setup: [SETUP.md](SETUP.md)
- Quick start: [QUICKSTART.md](QUICKSTART.md)
- Deployment: [DEPLOYMENT.md](DEPLOYMENT.md)
- Logging/health: [LOGGING.md](LOGGING.md)

### Adaptive UI Logic

```
Detected Emotion: Anxious (85% confidence)
         ↓
    Fuzzy Logic Processing
         ↓
    Output Configuration:
    - Background: Soft blue (bg-blue-50)
    - Text: Larger, more spacing
    - Hints: Shown
    - Quiz Difficulty: EASIER
    - Toast: "Take a deep breath 💙"
```

## 📊 Database Schema

```prisma
User         → id, name, email, role, learningStyle
Chapter      → id, title, description, orderIndex
Material     → id, chapterId, title, content, imageUrl
QuizLog      → id, userId, materialId, question, answer, score, emotion
EmotionLog   → id, userId, materialId, emotionLabel, confidence, timestamp
```

## 🔒 Privacy & Ethics

- **Camera Privacy:** Video never stored, only predictions
- **Opt-in:** Students control camera activation
- **Transparency:** Clear indicators when emotion detection is active
- **Data Protection:** Emotion logs used only for learning improvement

## 🎓 Academic Context

**Thesis Title:** "Emotion-Aware Adaptive Learning System"

**Research Questions:**
1. Can real-time emotion detection improve learning outcomes?
2. How effective is fuzzy logic for adaptive UI decisions?
3. Does learning style personalization reduce anxiety?

**Methodologies:**
- Fuzzy Logic Expert System
- Machine Learning (TensorFlow.js)
- Natural Language Processing (Gemini AI)
- VARK Learning Style Model

## 📚 API Documentation

### Student APIs

**POST** `/api/student/onboarding`
```json
{
  "userId": "user_123",
  "answers": { "1": "VISUAL", "2": "AUDITORY", ... }
}
```

**POST** `/api/student/log-emotion`
```json
{
  "userId": "user_123",
  "materialId": "mat_456",
  "emotionLabel": "Anxious",
  "confidence": 0.85
}
```

### Quiz APIs

**POST** `/api/quiz/generate`
```json
{
  "materialId": "mat_456",
  "userId": "user_123",
  "currentEmotion": "Anxious",
  "confidence": 0.85
}
```

**POST** `/api/quiz/feedback`
```json
{
  "userId": "user_123",
  "materialId": "mat_456",
  "question": "What is 2+2?",
  "userAnswer": "4",
  "expectedAnswer": "4",
  "currentEmotion": "Happy"
}
```

## 🛠️ Development Commands

```bash
# Development
npm run dev              # Start dev server

# Database
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema to database
npm run db:studio        # Open Prisma Studio GUI

# Build
npm run build            # Production build
npm run start            # Start production server

# Code Quality
npm run lint             # ESLint check
```

## 🐛 Troubleshooting

### Issue: Model not loading
- Ensure `/public/model/tfjs_model/model.json` exists
- Check browser console for errors
- Verify model format is TensorFlow.js compatible

### Issue: Database connection failed
- Check MySQL is running: `mysql -u root -p`
- Verify `DATABASE_URL` in `.env`
- Run `npm run db:push` to create tables

### Issue: AI provider error (Gemini/Mistral)
- Verify `GEMINI_API_KEY` or `MISTRAL_API_KEY` is configured correctly
- If Gemini is rate-limited, the system will fall back to Mistral (when configured)
- Check provider quota/limits

## 🤝 Contributing

This is a thesis project. For academic collaboration:
1. Fork the repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is for academic purposes. Please cite if used in research.

## 👨‍💻 Author

**Final Year Thesis Project**
- AI & AR Based Math Learning Platform
- With Expert System Based Emotion Recognition

## 🙏 Acknowledgments

- Google Teachable Machine for emotion detection framework
- Gemini + Mistral for quiz generation (with fallback)
- Prisma for excellent ORM
- Next.js team for amazing framework

---

**Note:** This system is designed for educational research. Ensure proper ethical approval before deploying with real students.
