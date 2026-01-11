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
- 🤖 **AI-Powered Quiz Generation** - Google Gemini creates personalized questions
- 📊 **Learning Style Adaptation** - Visual, Auditory, or Kinesthetic preference detection
- 👩‍🏫 **Teacher Dashboard** - Monitor student well-being and anxiety patterns
- 📈 **Analytics & Insights** - Track emotional trends and learning progress

## 🏗️ Architecture

### Tech Stack

- **Frontend:** Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Prisma ORM
- **Database:** MySQL (Local)
- **AI/ML:**
  - Client-side: TensorFlow.js + Teachable Machine
  - Server-side: Google Generative AI (Gemini 1.5 Flash)
- **State Management:** Zustand
- **Validation:** Zod

### System Actors

1. **Students (Murid)**
   - Complete learning style questionnaire
   - View adaptive learning materials
   - Take AI-generated quizzes
   - Track emotional journey

2. **Teachers (Guru)**
   - Create/manage content (CMS)
   - Monitor student anxiety patterns
   - View class performance analytics

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- MySQL 8.0+
- Google Gemini API Key ([Get here](https://makersuite.google.com/app/apikey))
- Trained Teachable Machine Model ([Train here](https://teachablemachine.withgoogle.com/))

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Platform-Pembelajaran-Matematika-Berbasis-AI-AR-Dengan-Pengenalan-Emosi-Berbasis-Expert-System
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and add:
   ```env
   DATABASE_URL="mysql://user:password@localhost:3306/emotion_learning_db"
   GEMINI_API_KEY="your_gemini_api_key"
   NEXTAUTH_SECRET="generate_random_secret"
   ```

4. **Setup database**
   ```bash
   # Generate Prisma Client
   npm run db:generate

   # Push schema to database
   npm run db:push

   # (Optional) Seed with sample data
   npm run db:seed
   ```

5. **Add Emotion Detection Model**
   - Train your model at [Teachable Machine](https://teachablemachine.withgoogle.com/)
   - Export as TensorFlow.js
   - Place `model.json` and `metadata.json` in `/public/model/`

6. **Run development server**
   ```bash
   npm run dev
   ```
   
   The system will perform automatic startup checks including:
   - ✅ Database connection verification
   - ✅ AI model availability check
   - ✅ Environment configuration validation
   - ✅ TensorFlow.js initialization
   
   See detailed logs in your terminal. For more info, check [STARTUP_LOGGING.md](STARTUP_LOGGING.md)
   
   Open [http://localhost:3000](http://localhost:3000)

7. **Manual Health Check (Optional)**
   ```bash
   # Run system health check anytime
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

### Issue: Gemini API error
- Verify `GEMINI_API_KEY` is correct
- Check API quota/limits
- Test key at [Google AI Studio](https://makersuite.google.com/)

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
- Platform Pembelajaran Matematika Berbasis AI & AR
- Dengan Pengenalan Emosi Berbasis Expert System

## 🙏 Acknowledgments

- Google Teachable Machine for emotion detection framework
- Google Gemini AI for quiz generation
- Prisma for excellent ORM
- Next.js team for amazing framework

---

**Note:** This system is designed for educational research. Ensure proper ethical approval before deploying with real students.
