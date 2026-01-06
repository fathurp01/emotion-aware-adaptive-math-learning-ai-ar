/**
 * Database Seeder
 * 
 * Run: npx ts-node prisma/seed.ts
 * 
 * Seeds the database with initial data:
 * - Sample chapters
 * - Sample materials
 * - Demo users (student & teacher)
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...\n');

  // Create demo users
  console.log('Creating demo users...');
  
  const hashedPassword = await bcrypt.hash('password123', 10);

  const teacher = await prisma.user.upsert({
    where: { email: 'teacher@demo.com' },
    update: {},
    create: {
      email: 'teacher@demo.com',
      name: 'Demo Teacher',
      password: hashedPassword,
      role: 'TEACHER',
    },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@demo.com' },
    update: {},
    create: {
      email: 'student@demo.com',
      name: 'Demo Student',
      password: hashedPassword,
      role: 'STUDENT',
      learningStyle: 'VISUAL',
    },
  });

  console.log('✓ Created users:', { teacher: teacher.email, student: student.email });

  // Create chapters
  console.log('\nCreating chapters...');

  const chapter1 = await prisma.chapter.upsert({
    where: { id: 'ch1' },
    update: {},
    create: {
      id: 'ch1',
      title: 'Aljabar Dasar',
      description: 'Pengenalan konsep aljabar dan persamaan linear',
      orderIndex: 1,
    },
  });

  const chapter2 = await prisma.chapter.upsert({
    where: { id: 'ch2' },
    update: {},
    create: {
      id: 'ch2',
      title: 'Geometri',
      description: 'Bentuk, luas, dan volume bangun ruang',
      orderIndex: 2,
    },
  });

  console.log('✓ Created chapters:', chapter1.title, chapter2.title);

  // Create materials
  console.log('\nCreating materials...');

  await prisma.material.upsert({
    where: { id: 'mat1' },
    update: {},
    create: {
      id: 'mat1',
      title: 'Persamaan Linear Satu Variabel',
      chapterId: chapter1.id,
      difficulty: 'EASY',
      content: `# Persamaan Linear Satu Variabel

## Definisi
Persamaan linear satu variabel adalah persamaan yang hanya memiliki satu variabel dengan pangkat tertinggi 1.

## Bentuk Umum
ax + b = c

Dimana:
- a, b, c adalah konstanta
- x adalah variabel
- a ≠ 0

## Contoh Soal
1. 2x + 5 = 11
   Solusi: 2x = 11 - 5
           2x = 6
           x = 3

2. 3x - 7 = 8
   Solusi: 3x = 8 + 7
           3x = 15
           x = 5

## Langkah Penyelesaian
1. Pindahkan semua suku yang mengandung variabel ke ruas kiri
2. Pindahkan semua konstanta ke ruas kanan
3. Bagi kedua ruas dengan koefisien variabel`,
      imageUrl: null,
    },
  });

  await prisma.material.upsert({
    where: { id: 'mat2' },
    update: {},
    create: {
      id: 'mat2',
      title: 'Sistem Persamaan Linear',
      chapterId: chapter1.id,
      difficulty: 'MEDIUM',
      content: `# Sistem Persamaan Linear Dua Variabel

## Definisi
Sistem persamaan linear dua variabel terdiri dari dua persamaan linear dengan dua variabel yang sama.

## Bentuk Umum
a₁x + b₁y = c₁
a₂x + b₂y = c₂

## Metode Penyelesaian

### 1. Metode Substitusi
- Nyatakan salah satu variabel dari persamaan pertama
- Substitusikan ke persamaan kedua
- Selesaikan untuk mendapatkan nilai variabel

### 2. Metode Eliminasi
- Samakan koefisien salah satu variabel
- Kurangkan atau tambahkan kedua persamaan
- Selesaikan untuk mendapatkan nilai variabel

## Contoh
x + y = 5
2x - y = 1

Solusi menggunakan eliminasi:
- Tambahkan kedua persamaan: 3x = 6, maka x = 2
- Substitusi x = 2 ke persamaan pertama: 2 + y = 5, maka y = 3`,
      imageUrl: null,
    },
  });

  await prisma.material.upsert({
    where: { id: 'mat3' },
    update: {},
    create: {
      id: 'mat3',
      title: 'Luas dan Keliling Lingkaran',
      chapterId: chapter2.id,
      difficulty: 'EASY',
      content: `# Lingkaran

## Definisi
Lingkaran adalah himpunan semua titik pada bidang yang berjarak sama dari suatu titik tetap yang disebut pusat lingkaran.

## Rumus Penting

### Keliling Lingkaran
K = 2πr atau K = πd

Dimana:
- K = keliling
- r = jari-jari
- d = diameter
- π ≈ 3.14 atau 22/7

### Luas Lingkaran
L = πr²

## Contoh Soal
1. Sebuah lingkaran memiliki jari-jari 7 cm. Hitunglah:
   a) Keliling = 2 × 22/7 × 7 = 44 cm
   b) Luas = 22/7 × 7² = 154 cm²

2. Keliling sebuah lingkaran adalah 88 cm. Hitunglah jari-jarinya!
   K = 2πr
   88 = 2 × 22/7 × r
   r = 14 cm`,
      imageUrl: null,
    },
  });

  console.log('✓ Created 3 materials');

  console.log('\n✅ Seeding completed successfully!\n');
  console.log('Demo accounts:');
  console.log('  Teacher: teacher@demo.com / password123');
  console.log('  Student: student@demo.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
