# DOKUMENTASI API (API DOCUMENTATION)
## Emotion-Aware Adaptive Math Learning AI & AR Platform

Dokumentasi ini menyediakan panduan lengkap mengenai seluruh endpoints API yang tersedia di server Backend platform pembelajaran matematika adaptif. Semua REST API diimplementasikan menggunakan Next.js API Routes (App Router) pada port `5000` (produksi: diproksi via Cloudflare CDN).

---

## 🔒 Skema Keamanan & Autentikasi
Autentikasi menggunakan JSON Web Token (JWT) yang disimpan di dalam cookie peramban dengan atribut **HTTP-Only**, **Secure**, dan **SameSite=Lax**.
* **Header Keamanan**: Autentikasi ditangani secara otomatis melalui middleware Next.js (`middleware.ts`) berdasarkan JWT cookie tersebut.
* **Tipe Pengguna (Role)**: Terdapat dua peran pengguna, yaitu `STUDENT` (Siswa) dan `TEACHER` (Guru).

---

## 🔑 Endpoints Autentikasi (Authentication)

### 1. Registrasi Pengguna Baru (`POST /api/auth/register`)
Membuat akun baru sebagai siswa (`STUDENT`) atau guru (`TEACHER`).

* **Request Body (JSON):**
```json
{
  "name": "Fathur Rahman",
  "email": "student@demo.com",
  "password": "securepassword123",
  "role": "STUDENT"
}
```
* **Response Sukses (201 Created):**
```json
{
  "success": true,
  "user": {
    "id": "usr_982138",
    "name": "Fathur Rahman",
    "email": "student@demo.com",
    "role": "STUDENT"
  },
  "message": "Registration successful"
}
```
* **Response Gagal (400 Bad Request - Email Sudah Ada):**
```json
{
  "error": "Email already registered"
}
```

---

### 2. Login Pengguna (`POST /api/auth/login`)
Memverifikasi kredensial pengguna dan mengembalikan JWT di dalam session cookie.

* **Request Body (JSON):**
```json
{
  "email": "student@demo.com",
  "password": "securepassword123"
}
```
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "user": {
    "id": "usr_982138",
    "name": "Fathur Rahman",
    "email": "student@demo.com",
    "role": "STUDENT"
  }
}
```
* **Response Gagal (401 Unauthorized):**
```json
{
  "error": "Invalid email or password"
}
```

---

### 3. Logout Pengguna (`POST /api/auth/logout`)
Menghapus session cookie JWT untuk mengeluarkan pengguna dari sistem.

* **Request Body:** None
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 4. Periksa Sesi Pengguna Aktif (`GET /api/auth/me`)
Mengambil data profil pengguna yang sedang login berdasarkan cookie JWT aktif.

* **Request Body:** None
* **Response Sukses (200 OK):**
```json
{
  "user": {
    "id": "usr_982138",
    "name": "Fathur Rahman",
    "email": "student@demo.com",
    "role": "STUDENT",
    "learningStyle": "VISUAL"
  }
}
```

---

## 🎓 Endpoints Portal Siswa (Student Portal)

### 1. Ambil Daftar Bab/Materi (`GET /api/student/chapters`)
Mengambil semua outline materi pembelajaran beserta bab-babnya untuk siswa.

* **Response Sukses (200 OK):**
```json
[
  {
    "id": "ch_01",
    "title": "Aljabar Linear",
    "description": "Dasar persamaan linier satu variabel.",
    "orderIndex": 1,
    "materials": [
      {
        "id": "mat_101",
        "title": "Variabel dan Koefisien",
        "imageUrl": "https://media.node-f3a17c.my.id/geom.png"
      }
    ]
  }
]
```

---

### 2. Detail Materi Spesifik (`GET /api/student/material/[id]`)
Mengambil detail isi konten materi pembelajaran matematika tertentu berdasarkan ID.

* **Response Sukses (200 OK):**
```json
{
  "id": "mat_101",
  "chapterId": "ch_01",
  "title": "Variabel dan Koefisien",
  "content": "# Pendahuluan Aljabar\nVariabel adalah simbol...",
  "imageUrl": "https://media.node-f3a17c.my.id/geom.png",
  "chapter": {
    "id": "ch_01",
    "title": "Aljabar Linear",
    "description": "Dasar persamaan linier satu variabel."
  }
}
```

---

### 3. Log Deteksi Emosi (`POST /api/student/log-emotion`)
Mengirimkan data hasil deteksi emosi dari webcam siswa ke database. Dibatasi dengan debounce (dikirim maksimal sekali per 5 detik).

* **Request Body (JSON):**
```json
{
  "userId": "usr_982138",
  "materialId": "mat_101",
  "emotionLabel": "Anxious",
  "confidence": 0.85
}
```
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "message": "Emotion logged successfully"
}
```

---

### 4. Ambil Konten Remedial Personal (`GET /api/student/material/[id]/remedial`)
Mengambil materi remedial yang telah dipersonalisasi untuk siswa berdasarkan performa kuis dan emosi negatif mereka.

* **Query Parameters:** `?userId=usr_982138`
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "data": {
    "content": "# Remedial Variabel & Koefisien\nHalo Fathur, mari pelajari kembali konsep ini dengan bantuan diagram visual...",
    "updatedAt": "2026-06-11T08:00:00Z",
    "emotionLabel": "Negative"
  }
}
```

---

### 5. Generate Konten Remedial (`POST /api/student/material/[id]/remedial`)
Memicu LLM untuk membuat ringkasan materi remedial baru secara dinamis karena nilai kuis siswa di bawah KKM.

* **Request Body (JSON):**
```json
{
  "userId": "usr_982138",
  "lastAttempt": {
    "question": "Selesaikan: 2x + 4 = 10",
    "userAnswer": "x = 4",
    "expectedAnswer": "x = 3",
    "aiFeedback": "Jawaban Anda salah karena...",
    "score": 40
  },
  "emotionLabel": "Negative",
  "wrongCount": 3,
  "avgScore": 55.5
}
```
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "data": {
    "content": "# Remedial Personal...\n...",
    "emotionLabel": "Negative",
    "updatedAt": "2026-06-11T08:05:00Z"
  }
}
```

---

### 6. Submit Kuesioner Gaya Belajar (`POST /api/student/onboarding`)
Mengirimkan jawaban kuisioner awal (VARK) untuk menentukan tipe gaya belajar siswa (`VISUAL`, `AUDITORY`, atau `KINESTHETIC`).

* **Request Body (JSON):**
```json
{
  "userId": "usr_982138",
  "answers": {
    "q1": "A",
    "q2": "C",
    "q3": "B",
    "q4": "A"
  }
}
```
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "learningStyle": "VISUAL",
  "message": "Learning style determined successfully"
}
```

---

### 7. Resep Model 3D AR (`GET /api/student/material/[id]/ar-recipe`)
Mengambil spesifikasi resep interaktif visual 3D Augmented Reality (Kinesthetic) untuk ditampilkan menggunakan pustaka visualisasi client-side.

* **Response Sukses (200 OK):**
```json
{
  "materialId": "mat_101",
  "modelType": "cube",
  "dimensions": { "width": 2, "height": 2, "depth": 2 },
  "labels": ["Sisi A", "Sisi B", "Volume = s^3"],
  "scale": 1.0
}
```

---

### 8. Penjelasan Naratif Audio TTS (`GET /api/student/material/[id]/audio-script`)
Mengambil naskah penulisan naratif audio (Auditory) untuk dikonversi menjadi suara (Text-to-Speech) di browser.

* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "script": "Hello! Welcome to Chapter 1. In this section, we will learn about variables. A variable is like a container..."
}
```

---

## 🤖 Endpoints Kuis Adaptif (Adaptive Quiz Engine)

### 1. Inisialisasi / Buat Pertanyaan Kuis (`POST /api/quiz/generate`)
Menghasilkan pertanyaan matematika adaptif baru menggunakan NVIDIA NIM API (fallback: Gemini / Mistral) yang disesuaikan dengan emosi siswa terkini dan gaya belajarnya.

* **Request Body (JSON):**
```json
{
  "userId": "usr_982138",
  "materialId": "mat_101",
  "currentEmotion": "Anxious",
  "confidence": 0.85
}
```
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "question": "Sederhanakan persamaan berikut: 3y - 6 = 12. Berapakah nilai y?",
  "hint": "Coba tambahkan 6 ke kedua sisi persamaan terlebih dahulu. Ambil napas dalam-dalam, kamu pasti bisa!",
  "difficulty": "EASY",
  "supportiveMessage": "Mari coba soal ini perlahan, ya. Tidak perlu terburu-buru."
}
```

---

### 2. Koreksi & Evaluasi Jawaban (`POST /api/quiz/feedback`)
Mengirimkan jawaban siswa untuk diperiksa oleh AI, mendapatkan skor, penjelasan langkah-demi-langkah, dan kata-kata motivasi adaptif.

* **Request Body (JSON):**
```json
{
  "userId": "usr_982138",
  "materialId": "mat_101",
  "question": "Sederhanakan persamaan berikut: 3y - 6 = 12. Berapakah nilai y?",
  "userAnswer": "y = 6",
  "expectedAnswer": "y = 6",
  "currentEmotion": "Happy"
}
```
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "score": 100,
  "isCorrect": true,
  "explanation": "Langkah-langkah:\n1) Tambahkan 6 di kedua ruas: 3y = 18\n2) Bagi kedua ruas dengan 3: y = 6. Hasil Anda tepat!",
  "supportiveMessage": "Hebat sekali! Jawabanmu benar. Pertahankan energi positif ini!"
}
```

---

## 👩‍🏫 Endpoints Portal Guru (Teacher Portal)

### 1. CRUD Bab Materi (`GET`, `POST`, `PUT`, `DELETE` ke `/api/teacher/chapters`)
Mengelola data bab pelajaran oleh guru.

* **POST Request Body (Membuat Bab):**
```json
{
  "title": "Matriks & Vektor",
  "description": "Mempelajari operasi transpose dan determinan.",
  "orderIndex": 2
}
```
* **Response Sukses (201 Created):**
```json
{
  "success": true,
  "chapter": {
    "id": "ch_02",
    "title": "Matriks & Vektor",
    "description": "Mempelajari operasi transpose dan determinan.",
    "orderIndex": 2
  }
}
```

---

### 2. CRUD Konten Detail Pelajaran (`POST`, `PUT`, `DELETE` ke `/api/teacher/material`)
Mengelola data materi dalam bab oleh guru.

* **POST Request Body (Membuat Materi):**
```json
{
  "chapterId": "ch_02",
  "title": "Operasi Transpose Matriks",
  "content": "Transpose matriks adalah...",
  "imageUrl": "https://media.node-f3a17c.my.id/matrix.png"
}
```
* **Response Sukses (201 Created):**
```json
{
  "success": true,
  "material": {
    "id": "mat_201",
    "title": "Operasi Transpose Matriks"
  }
}
```

---

### 3. AI Refinement Materi (`POST /api/teacher/material/refine-preview`)
Mengirimkan draf materi buatan guru ke AI LLM untuk diperbaiki tata bahasa, penyusunan LaTeX, dan struktur penjelasannya secara otomatis sebelum disimpan.

* **Request Body (JSON):**
```json
{
  "title": "Aljabar dasar",
  "content": "aljabar itu ada variabel misal x + 2 = 5 maka x nya 3."
}
```
* **Response Sukses (200 OK):**
```json
{
  "success": true,
  "refinedContent": "# Konsep Aljabar Dasar\n\nDalam aljabar, kita menggunakan **variabel** (simbol yang mewakili angka tidak diketahui). \n\n$$\nx + 2 = 5\n$$\n\nUntuk mencari nilai $x$, kurangi $2$ pada kedua sisi:\n$$\nx = 3\n$$"
}
```

---

### 4. Analisis & Statistik Siswa (`GET /api/teacher/students`)
Mengambil data ringkasan seluruh siswa untuk diplot pada dashboard analitik guru (gaya belajar, tingkat kecemasan, rata-rata nilai).

* **Response Sukses (200 OK):**
```json
[
  {
    "id": "usr_982138",
    "name": "Fathur Rahman",
    "email": "student@demo.com",
    "learningStyle": "VISUAL",
    "avgQuizScore": 84.5,
    "lastDetectedEmotion": "Positive",
    "anxietyTrend": [
      { "date": "2026-06-10", "negativeCount": 2 },
      { "date": "2026-06-11", "negativeCount": 0 }
    ]
  }
]
```

---

## 🏥 Endpoint Health & Status

### 1. Pengecekan Kesehatan Sistem (`GET /api/health`)
Endpoint publik untuk verifikasi kesiapan kontainer dan koneksi basis data relasional.

* **Response Sukses (200 OK):**
```json
{
  "status": "healthy",
  "database": "connected",
  "ai_services": {
    "nvidia": "active",
    "gemini": "active",
    "mistral": "active"
  },
  "timestamp": "2026-06-11T09:00:00.000Z"
}
```
* **Response Degraded / Rusak (503 Service Unavailable):**
```json
{
  "status": "degraded",
  "database": "disconnected",
  "error": "Can't reach database server at 10.3.1.200"
}
```
