# Emotion-Aware Adaptive Math Learning AI & AR Platform

An advanced, cloud-native adaptive learning application aligned with **SDG 4 (Quality Education)**. The platform adapts math course material difficulty and learning style delivery in real-time based on the student's **learning style preferences** and **real-time detected emotions** (captured via webcam).

---

## 2. Repository GitHub

Repository proyek ini telah disusun secara terstruktur untuk memenuhi seluruh kriteria pengumpulan berkas dan standar arsitektur cloud-native. Berikut adalah penjelasan mendetail mengenai setiap komponen wajib di dalam repositori:

### 🖥️ A. Frontend
Aplikasi antarmuka pengguna (User Interface) dibangun menggunakan **Next.js 14** (App Router), React, Tailwind CSS, dan TypeScript.
*   **Lokasi**: [`/frontend`](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/frontend) (Port `3000`)
*   **Fitur Utama**: 
    *   Dashboard Siswa: Kuesioner onboarding gaya belajar (VARK) dan daftar materi pelajaran matematika adaptif.
    *   **Smart Emotion Camera (AI)**: Menjalankan pemrosesan Computer Vision client-side menggunakan TensorFlow.js lokal dan fallback MediaPipe untuk mendeteksi emosi wajah siswa secara real-time.
    *   Dashboard Analitik Guru: Visualisasi diagram gaya belajar siswa, tren emosi kecemasan, monitoring log aktivitas kuis, serta CRUD materi dengan visualisasi AR.

### ⚙️ B. Backend
API Gateway dan pusat logika orkestrasi AI backend dibangun menggunakan **Next.js Serverless API Routes**.
*   **Lokasi**: [`/backend`](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/backend) (Port `5000`)
*   **Fitur Utama**:
    *   Autentikasi ganda (Guru & Siswa) menggunakan session cookie JWT (HTTP-Only & Secure).
    *   Orkestrasi model bahasa besar (LLM) multi-tier: NVIDIA NIM API (Llama 3.1 8B Instruct), fallback Gemini API, dan fallback Mistral AI untuk generasi kuis dinamis serta feedback terpersonalisasi.
    *   Logika Fuzzy (*Expert System*): Memetakan masukan emosi, durasi waktu, dan jumlah kesalahan jawaban menjadi adaptasi antarmuka dan penyesuaian tingkat kesulitan.
    *   Integrasi Object Storage S3-Compatible untuk menyimpan media pembelajaran terpisah (Multi-Cloud).

### 🗄️ C. Database (.sql)
Penyimpanan relasional terstruktur menggunakan basis data **MySQL** (produksi: AWS RDS).
*   **Penerapan**: Struktur database didefinisikan secara deklaratif menggunakan schema ORM Prisma di [`backend/prisma/schema.prisma`](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/backend/prisma/schema.prisma). 
*   **Keuntungan**: Skema basis data dapat di-deploy ulang secara instan ke server MySQL manapun tanpa membutuhkan file `.sql` mentah terpisah melalui perintah `npx prisma db push`.
*   **Data Awal (Seeding)**: Disediakan script seeding otomatis di [`backend/prisma/seed.ts`](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/backend/prisma/seed.ts) untuk menginisiasi akun demo Guru (`teacher@demo.com`) dan Siswa (`student@demo.com`).

### 📦 D. Dockerfile
Pengemasan aplikasi ke dalam bentuk kontainer mandiri (Containerization) untuk memastikan konsistensi deployment.
*   **Lokasi**: [`frontend/Dockerfile`](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/frontend/Dockerfile) dan [`backend/Dockerfile`](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/backend/Dockerfile).
*   **Strategi**: Menggunakan metode **Multi-Stage Build** (Stage `deps` -> `builder` -> `runner`) menggunakan base image Node.js Alpine yang sangat ringan untuk mengoptimalkan ukuran image final dan mempercepat proses CI/CD.

### 🌐 E. docker-compose.yml
Konfigurasi orkestrasi kontainer lokal untuk menjalankan seluruh ekosistem aplikasi secara bersamaan.
*   **Lokasi**: [`docker-compose.yml`](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/docker-compose.yml) di direktori root.
*   **Layanan**: Menggabungkan kontainer database `mysql:8.0`, `backend` API Next.js (port 5000), dan `frontend` Next.js (port 3000) dalam satu virtual network terisolasi agar dapat berkomunikasi.

### 📖 F. README.md
Dokumen utama (unified documentation) yang Anda baca saat ini. Berfungsi sebagai panduan komprehensif bagi pengembang dan penguji untuk memahami fitur, struktur proyek, cara pemasangan secara lokal, detail deployment infrastruktur AWS (Terraform), Kubernetes manifests, dan Prometheus/Grafana monitoring.

### 🔌 G. Dokumentasi API
Dokumentasi terperinci mengenai seluruh arsitektur REST API yang disediakan oleh Backend.
*   **Berkas**: [DOKUMENTASI_API.md](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/DOKUMENTASI_API.md) di direktori root.
*   **Cakupan**: Menjelaskan metode HTTP (`GET`/`POST`/`PUT`/`DELETE`), query parameters, struktur input/output JSON payload, penanganan session cookie JWT, serta validasi skema data menggunakan pustaka Zod.

### 🤖 H. Dokumentasi AI
Dokumentasi teknis mendalam mengenai implementasi sistem cerdas pada aplikasi.
*   **Berkas**: [DOKUMENTASI_AI.md](file:///o:/Cloud-UAS/emotion-aware-adaptive-math-learning-ai-ar/DOKUMENTASI_AI.md) di direktori root.
*   **Cakupan**: Menjelaskan detail model Convolutional Neural Network (CNN) TensorFlow.js lokal yang berjalan di sisi klien, mekanisme fallback ganda (MediaPipe Face Landmarker & Safe Mode), alur pemanggilan model bahasa besar (NVIDIA NIM Llama, Gemini, Mistral), diagram alur logika fuzzy, serta mekanisme Hold-Time 60 detik untuk mencegah kedipan UI (*anti-flicker UI*).

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
├── DOKUMENTASI_API.md       # Detailed API endpoints & JSON payloads
├── DOKUMENTASI_AI.md       # AI models, fallbacks, & Fuzzy Logic details
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
