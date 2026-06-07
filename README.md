# Emotion-Aware Adaptive Math Learning AI & AR Platform

An advanced, cloud-native adaptive learning application aligned with **SDG 4 (Quality Education)**. The platform adapts math course material difficulty and learning style delivery in real-time based on the student's **learning style preferences** and **real-time detected emotions** (captured via webcam).

---

## 🌟 Key Features

1. **Emotion Recognition (AI / Computer Vision)**:
   * Real-time client-side emotion logging using **TensorFlow.js** in the browser.
   * Classifies student mood (Positive, Neutral, Negative) to dynamically adapt content.
2. **Adaptive Math Quiz (AI / LLM)**:
   * Integrates the high-performance **NVIDIA NIM API** (`meta/llama-3.1-8b-instruct`) for dynamic quiz question generation.
   * Fallback engines: Google Gemini API and Mistral AI.
3. **Fuzzy Logic Adaptation**:
   * Tailors math question difficulty (EASY, MEDIUM, HARD) based on response time, wrong answer counts, and current emotions.
4. **Teacher Analytics Dashboard**:
   * Real-time monitoring of student learning styles, mood logs, and quiz grades.

---

## 🏛 Cloud Native & Multi-Cloud Architecture

This project is built using a **Cloud-Native, Decoupled Architecture**:

* **Frontend**: Next.js React UI, MediaPipe, and TensorFlow.js client-side emotion detection (Port `3000`).
* **Backend**: Next.js Server-side APIs, Prisma ORM, and LLM integrations (Port `5000`).
* **Database**: MySQL relational store.
* **Object Storage (Multi-Cloud)**: Integrates S3-compatible endpoints (AWS S3, Cloudflare R2, GCP Cloud Storage) for asset storage, satisfying the requirement to separate storage from primary compute resources.

---

## 📂 Project Structure

```text
emotion-aware-adaptive-math-learning-ai-ar/
├── .github/workflows/       # GitHub Actions CI/CD Pipeline
├── frontend/                # Next.js Frontend Web Application (Port 3000)
├── backend/                 # Next.js Backend API Server (Port 5000)
├── terraform/               # Infrastructure as Code (Segmented VPCs & Compute)
├── k8s/                     # Kubernetes Manifests (Deployments, StatefulSet, HPA)
├── monitoring/              # Prometheus & Grafana Monitoring Configuration
├── docker-compose.yml       # Production docker-compose orchestration
└── README.md                # Unified main documentation
```

---

## 🚀 Getting Started

### Prerequisites
* Node.js v20+
* Docker & Docker Compose
* MySQL (if running locally without Docker)
* NVIDIA AI API Key (NIM)

### Running via Docker Compose (Recommended)
Orchestrates the Frontend, Backend, and MySQL database instantly:

1. Clone the repository and navigate to the root directory.
2. Configure credentials in [backend/.env](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/backend/.env) and [frontend/.env](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/frontend/.env).
3. Spin up the container services:
   ```bash
   docker compose up --build -d
   ```
4. Run DB migrations and seed the demo data:
   ```bash
   docker compose exec backend npx prisma db push
   # Seeds student@demo.com and teacher@demo.com accounts
   docker compose exec backend npx prisma db seed
   ```
5. Access the platforms:
   * Frontend: `http://localhost:3000`
   * Backend API: `http://localhost:5000`

---

## 🔌 API Documentation

### Authentication
* **POST `/api/auth/login`**: Logs in student/teacher, sets JWT HTTP-only session cookie.
* **GET `/api/auth/me`**: Returns currently logged-in user profile.
* **POST `/api/auth/logout`**: Clears authentication cookies.

### Student Dashboard & Learning
* **GET `/api/student/chapters`**: Returns course outline with chapters and material links.
* **GET `/api/student/material/[id]`**: Fetches lesson content.
* **POST `/api/student/log-emotion`**: Submits a webcam emotion log.

### Adaptive Quiz Engine
* **POST `/api/quiz/generate`**: Generates a recap question (Q1) or an adaptive math calculation question (Q2-Q10) using NVIDIA Llama.
* **POST `/api/quiz/feedback`**: Grades user answers and responds with score and supportive feedback.

---

## 🛡 Security & Networking (VPC Segmentations)
The production deployment utilizes **4 Segmented VPCs** (defined in `terraform/main.tf`):
* **Frontend VPC**: Exposed to public internet via Internet Gateway.
* **Backend VPC**: Private subnet; accepts traffic only from the Frontend VPC.
* **Database VPC**: Private subnet; accepts connections only from the Backend VPC.
* **Storage VPC**: Connects backend instances to private S3 endpoints.

---

## 📊 Prometheus & Grafana Monitoring
To start the monitoring dashboard stack:
```bash
cd monitoring
docker compose -f docker-compose.monitoring.yml up -d
```
Access dashboards:
* **Prometheus**: `http://localhost:9090`
* **Grafana**: `http://localhost:3001` (Credentials: `admin` / `admin`)
