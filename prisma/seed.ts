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
import { createHash } from 'crypto';

const prisma = new PrismaClient();

function sha256(input: string): string {
  return createHash('sha256').update(input ?? '', 'utf8').digest('hex');
}

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

  const chapter3 = await prisma.chapter.upsert({
    where: { id: 'ch3' },
    update: {},
    create: {
      id: 'ch3',
      title: 'Bilangan & Aritmetika Sosial',
      description: 'Bilangan, pecahan, persen, dan aplikasi sehari-hari',
      orderIndex: 3,
    },
  });

  const chapter4 = await prisma.chapter.upsert({
    where: { id: 'ch4' },
    update: {},
    create: {
      id: 'ch4',
      title: 'Statistika & Peluang',
      description: 'Mengolah data dan peluang kejadian sederhana',
      orderIndex: 4,
    },
  });

  const chapter5 = await prisma.chapter.upsert({
    where: { id: 'ch5' },
    update: {},
    create: {
      id: 'ch5',
      title: 'Perbandingan & Skala',
      description: 'Rasio, skala peta, dan perbandingan senilai/berbalik nilai',
      orderIndex: 5,
    },
  });

  const chapter6 = await prisma.chapter.upsert({
    where: { id: 'ch6' },
    update: {},
    create: {
      id: 'ch6',
      title: 'Fungsi & Transformasi',
      description: 'Konsep fungsi, grafik, dan transformasi geometri',
      orderIndex: 6,
    },
  });

  console.log('✓ Created chapters:', chapter1.title, chapter2.title, chapter3.title, chapter4.title, chapter5.title, chapter6.title);

  // Create materials
  console.log('\nCreating materials...');

  const materials: Array<{
    id: string;
    title: string;
    chapterId: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    content: string;
  }> = [
    {
      id: 'mat1',
      title: 'Persamaan Linear Satu Variabel (PLSV)',
      chapterId: chapter1.id,
      difficulty: 'EASY',
      content: `# Persamaan Linear Satu Variabel (PLSV)

## Tujuan Belajar
- Memahami bentuk umum PLSV dan komponen-komponennya.
- Menyelesaikan PLSV dengan langkah yang runtut.
- Mengecek kebenaran solusi dengan substitusi.

## Konsep Inti
Persamaan linear satu variabel adalah persamaan yang memuat **satu variabel** (mis. $x$) dengan pangkat tertinggi **1**.

**Bentuk umum:**
$$ax + b = c$$
dengan $a \neq 0$.

## Strategi Penyelesaian
1. **Sederhanakan** (jika ada kurung/pecahan).
2. **Kumpulkan** suku yang memuat variabel di satu ruas.
3. **Kumpulkan** konstanta di ruas lain.
4. **Bagi** kedua ruas dengan koefisien variabel.
5. **Cek** dengan substitusi.

## Contoh 1
Selesaikan $2x + 5 = 11$.

Langkah:
$$2x = 11 - 5 = 6$$
$$x = 6/2 = 3$$
Cek: $2(3) + 5 = 11$ (benar).

## Contoh 2
Selesaikan $3x - 7 = 8$.

$$3x = 8 + 7 = 15$$
$$x = 15/3 = 5$$

## Latihan
1. $x + 9 = 17$
2. $5x - 10 = 25$
3. $4(x - 2) = 20$

## Kunci Singkat
1) $x=8$  2) $x=7$  3) $x=7$`,
    },
    {
      id: 'mat2',
      title: 'Sistem Persamaan Linear Dua Variabel (SPLDV)',
      chapterId: chapter1.id,
      difficulty: 'MEDIUM',
      content: `# Sistem Persamaan Linear Dua Variabel (SPLDV)

## Tujuan Belajar
- Memahami SPLDV sebagai pasangan persamaan linear.
- Menyelesaikan SPLDV dengan eliminasi dan substitusi.
- Menafsirkan solusi sebagai titik potong dua garis.

## Konsep Inti
SPLDV adalah dua persamaan linear dengan dua variabel yang sama, misalnya $x$ dan $y$:
$$a_1x + b_1y = c_1$$
$$a_2x + b_2y = c_2$$

Solusi SPLDV adalah pasangan $(x,y)$ yang memenuhi **keduanya**.

## Metode Eliminasi
Langkah umum:
1. Samakan koefisien salah satu variabel.
2. Jumlah/kurangi kedua persamaan untuk menghilangkan variabel itu.
3. Dapatkan satu variabel, lalu substitusikan untuk mendapatkan variabel lain.

## Contoh (Eliminasi)
Selesaikan:
$$x + y = 5$$
$$2x - y = 1$$

Jumlahkan kedua persamaan:
$$3x = 6 \Rightarrow x = 2$$
Substitusi ke $x+y=5$:
$$2 + y = 5 \Rightarrow y = 3$$
Jadi $(x,y)=(2,3)$.

## Metode Substitusi
Langkah umum:
1. Nyatakan salah satu variabel dari salah satu persamaan.
2. Substitusikan ke persamaan lain.
3. Selesaikan dan cek.

## Latihan
1. $x - y = 4$ dan $x + y = 10$
2. $2x + y = 11$ dan $x - y = 1$
3. $3x + 2y = 16$ dan $x + 2y = 8$

## Kunci Singkat
1) $(7,3)$  2) $(4,3)$  3) $(4,2)$`,
    },
    {
      id: 'mat3',
      title: 'Lingkaran: Keliling, Luas, dan Aplikasinya',
      chapterId: chapter2.id,
      difficulty: 'EASY',
      content: `# Lingkaran: Keliling, Luas, dan Aplikasinya

## Tujuan Belajar
- Menggunakan rumus keliling dan luas lingkaran.
- Menentukan jari-jari/diameter dari informasi keliling/luas.
- Menerapkan pada soal cerita.

## Konsep Inti
Lingkaran adalah himpunan titik pada bidang yang berjarak sama dari pusat.

Notasi:
- $r$ = jari-jari
- $d$ = diameter, dengan $d=2r$
- $\pi \approx 3{,}14$ atau $\pi = 22/7$ (jika cocok)

## Rumus Penting
Keliling:
$$K = 2\pi r = \pi d$$
Luas:
$$L = \pi r^2$$

## Contoh 1
$r=7$ cm, tentukan $K$ dan $L$.

$$K = 2\cdot \frac{22}{7}\cdot 7 = 44\text{ cm}$$
$$L = \frac{22}{7}\cdot 7^2 = 154\text{ cm}^2$$

## Contoh 2
Keliling $K=88$ cm, tentukan $r$.
$$88 = 2\cdot \frac{22}{7}\cdot r \Rightarrow r=14\text{ cm}$$

## Latihan
1. $d=10$ cm, hitung $K$.
2. $r=14$ cm, hitung $L$ (pakai $\pi=22/7$).
3. Sebuah taman berbentuk lingkaran dengan $r=7$ m. Berapa keliling pagarnya?

## Kunci Singkat
1) $K=31{,}4$ cm  2) $L=616\text{ cm}^2$  3) $K=44$ m`,
    },
    {
      id: 'mat4',
      title: 'Operasi Bilangan Bulat & Sifat-Sifatnya',
      chapterId: chapter3.id,
      difficulty: 'EASY',
      content: `# Operasi Bilangan Bulat & Sifat-Sifatnya

## Tujuan Belajar
- Menghitung penjumlahan, pengurangan, perkalian, dan pembagian bilangan bulat.
- Memahami sifat komutatif, asosiatif, dan distributif.

## Konsep Inti
Bilangan bulat meliputi $\{\ldots,-3,-2,-1,0,1,2,3,\ldots\}$.

### Aturan Tanda (ringkas)
- $(-) + (-)$ hasilnya negatif.
- $(-) \times (-)$ hasilnya positif.
- $(-) \times (+)$ hasilnya negatif.

## Sifat Operasi
- Komutatif: $a+b=b+a$, $a\times b=b\times a$
- Asosiatif: $(a+b)+c=a+(b+c)$, $(a\times b)\times c=a\times (b\times c)$
- Distributif: $a(b+c)=ab+ac$

## Contoh
1. $-7 + 12 = 5$
2. $-4 \times 6 = -24$
3. $-18 \div 3 = -6$
4. $3(5-2)=3\cdot 5-3\cdot 2=15-6=9$

## Latihan
1. $-15 + 8$
2. $-9 - (-4)$
3. $(-6)\times(-7)$

## Kunci Singkat
1) $-7$  2) $-5$  3) $42$`,
    },
    {
      id: 'mat5',
      title: 'Pecahan: Bentuk, Operasi, dan Penyederhanaan',
      chapterId: chapter3.id,
      difficulty: 'MEDIUM',
      content: `# Pecahan: Bentuk, Operasi, dan Penyederhanaan

## Tujuan Belajar
- Menyederhanakan pecahan dan mengubah bentuk (biasa, campuran, desimal).
- Melakukan operasi hitung pecahan.

## Konsep Inti
Pecahan $\frac{a}{b}$ dengan $b\neq 0$.

### Menyederhanakan
Gunakan FPB dari pembilang dan penyebut.
Contoh: $\frac{12}{18} = \frac{12\div 6}{18\div 6}=\frac{2}{3}$.

### Penjumlahan/Pengurangan
Samakan penyebut (KPK).
Contoh: $\frac{1}{4}+\frac{1}{6}=\frac{3}{12}+\frac{2}{12}=\frac{5}{12}$.

### Perkalian
Kalikan pembilang dan penyebut:
$\frac{2}{3}\times\frac{3}{5}=\frac{6}{15}=\frac{2}{5}$.

### Pembagian
Kalikan dengan kebalikan:
$\frac{3}{4}\div\frac{2}{5}=\frac{3}{4}\times\frac{5}{2}=\frac{15}{8}=1\frac{7}{8}$.

## Latihan
1. Sederhanakan $\frac{24}{36}$.
2. Hitung $\frac{2}{7}+\frac{3}{14}$.
3. Hitung $\frac{5}{6}\div\frac{5}{12}$.

## Kunci Singkat
1) $\frac{2}{3}$  2) $\frac{1}{2}$  3) $2$`,
    },
    {
      id: 'mat6',
      title: 'Persentase & Perubahan Nilai (Naik/Turun)',
      chapterId: chapter3.id,
      difficulty: 'MEDIUM',
      content: `# Persentase & Perubahan Nilai (Naik/Turun)

## Tujuan Belajar
- Mengubah pecahan/desimal ke persen dan sebaliknya.
- Menghitung nilai persen dari suatu jumlah.
- Menghitung kenaikan/penurunan persen.

## Konsep Inti
Persen artinya per seratus: $p\% = \frac{p}{100}$.

## Rumus Praktis
- $p\%$ dari $N$ adalah $\frac{p}{100}\times N$.
- Nilai baru setelah naik $p\%$: $N_{baru}=N\times(1+\frac{p}{100})$.
- Nilai baru setelah turun $p\%$: $N_{baru}=N\times(1-\frac{p}{100})$.

## Contoh
1. $15\%$ dari 200 = $0{,}15\times 200=30$.
2. Harga 80.000 naik 10%: $80.000\times 1{,}10=88.000$.
3. Nilai 90 turun 20%: $90\times 0{,}80=72$.

## Latihan
1. Ubah $0{,}35$ menjadi persen.
2. $12\%$ dari 250?
3. Berat 50 kg turun 8%, jadi berapa?

## Kunci Singkat
1) $35\%$  2) $30$  3) $46$ kg`,
    },
    {
      id: 'mat7',
      title: 'Aritmetika Sosial: Untung, Rugi, Diskon, Pajak',
      chapterId: chapter3.id,
      difficulty: 'MEDIUM',
      content: `# Aritmetika Sosial: Untung, Rugi, Diskon, Pajak

## Tujuan Belajar
- Menghitung untung/rugi dan persentasenya.
- Menghitung diskon beruntun.
- Menghitung harga setelah pajak.

## Konsep Inti
- Harga beli (HB), harga jual (HJ)
- Untung: $U=HJ-HB$ (jika $HJ>HB$)
- Rugi: $R=HB-HJ$ (jika $HJ<HB$)

Persentase untung:
$$\%U=\frac{U}{HB}\times 100\%$$

## Contoh 1 (Diskon)
Harga 200.000 diskon 15%.
$$\text{Diskon}=0{,}15\times 200.000=30.000$$
Harga bayar = 170.000.

## Contoh 2 (Untung)
HB 50.000 dijual 60.000.
Untung = 10.000, persen untung $=\frac{10.000}{50.000}\times 100\%=20\%$.

## Latihan
1. HB 80.000, HJ 72.000. Rugi berapa dan persen rugi?
2. Harga 120.000 diskon 10% lalu diskon lagi 5%. Berapa bayar?
3. Harga setelah pajak 11% dari 300.000?

## Kunci Singkat
1) rugi 8.000; 10%  2) 102.600  3) 333.000`,
    },
    {
      id: 'mat8',
      title: 'Perbandingan Senilai & Berbalik Nilai',
      chapterId: chapter5.id,
      difficulty: 'MEDIUM',
      content: `# Perbandingan Senilai & Berbalik Nilai

## Tujuan Belajar
- Mengenali perbandingan senilai dan berbalik nilai.
- Menyelesaikan soal rasio menggunakan tabel/perkalian silang.

## Konsep Inti
### Perbandingan Senilai
Jika $x$ naik, $y$ naik (atau sama-sama turun). Bentuk: $\frac{y}{x}=k$.

Contoh: 2 kg gula = 30.000, maka 5 kg = ?

### Perbandingan Berbalik Nilai
Jika $x$ naik, $y$ turun. Bentuk: $x\cdot y = k$.

Contoh: 4 pekerja selesai 6 hari, maka 8 pekerja = ?

## Contoh
1) Senilai: 2 kg 30.000 → 1 kg 15.000 → 5 kg 75.000.

2) Berbalik nilai:
$$4\times 6 = 24$$
Jika pekerja 8, hari $=24/8=3$.

## Latihan
1. 3 buku seharga 45.000. Harga 8 buku?
2. 12 keran mengisi bak dalam 5 menit. Jika 6 keran, berapa menit?
3. 6 liter bensin untuk 90 km. Jarak untuk 10 liter?

## Kunci Singkat
1) 120.000  2) 10 menit  3) 150 km`,
    },
    {
      id: 'mat9',
      title: 'Skala Peta & Denah',
      chapterId: chapter5.id,
      difficulty: 'EASY',
      content: `# Skala Peta & Denah

## Tujuan Belajar
- Menggunakan skala untuk menentukan jarak sebenarnya.
- Menghitung jarak pada peta dari jarak sebenarnya.

## Konsep Inti
Skala adalah perbandingan jarak pada peta (JP) terhadap jarak sebenarnya (JS).
$$\text{Skala} = \frac{JP}{JS}$$

Jika skala 1 : 50.000 artinya 1 cm pada peta = 50.000 cm sebenarnya.

## Langkah Cepat
1. Samakan satuan (biasanya cm).
2. Pakai rumus:
   - $JS = JP \times \text{penyebut skala}$
   - $JP = JS \div \text{penyebut skala}$

## Contoh
Skala 1:100.000, jarak pada peta 3 cm.
$$JS = 3\times 100.000 = 300.000\text{ cm} = 3\text{ km}$$

## Latihan
1. Skala 1:50.000, JP 8 cm. Berapa km?
2. JS 12 km, skala 1:200.000. Berapa cm di peta?
3. Skala 1:25.000, JP 6 cm. Berapa meter?

## Kunci Singkat
1) 4 km  2) 6 cm  3) 1.500 m`,
    },
    {
      id: 'mat10',
      title: 'Himpunan: Notasi, Anggota, dan Operasi Dasar',
      chapterId: chapter1.id,
      difficulty: 'EASY',
      content: `# Himpunan: Notasi, Anggota, dan Operasi Dasar

## Tujuan Belajar
- Menuliskan himpunan dengan cara daftar dan notasi pembentuk.
- Menggunakan operasi irisan dan gabungan.

## Konsep Inti
Himpunan adalah kumpulan objek yang terdefinisi jelas.

Notasi:
- $A=\{1,2,3\}$
- $x\in A$ artinya $x$ anggota A.

## Operasi Dasar
- Gabungan: $A\cup B$ (anggota A atau B)
- Irisan: $A\cap B$ (anggota A dan B)

## Contoh
Misal $A=\{1,2,3,4\}$ dan $B=\{3,4,5\}$.
- $A\cup B=\{1,2,3,4,5\}$
- $A\cap B=\{3,4\}$

## Latihan
1. Tulis himpunan bilangan genap kurang dari 10.
2. Jika $A=\{a,b,c\}$, $B=\{b,c,d\}$, tentukan $A\cap B$.
3. Tentukan $A\cup B$ untuk soal nomor 2.

## Kunci Singkat
1) $\{2,4,6,8\}$  2) $\{b,c\}$  3) $\{a,b,c,d\}$`,
    },
    {
      id: 'mat11',
      title: 'Garis dan Sudut: Jenis Sudut & Hubungan Sudut',
      chapterId: chapter2.id,
      difficulty: 'EASY',
      content: `# Garis dan Sudut

## Tujuan Belajar
- Mengenali jenis sudut (lancip, siku-siku, tumpul, lurus).
- Menggunakan hubungan sudut berpelurus dan berpenyiku.

## Konsep Inti
- Sudut siku-siku: $90^\circ$
- Sudut lurus: $180^\circ$
- Berpenyiku: jumlah $90^\circ$
- Berpelurus: jumlah $180^\circ$

## Contoh
1. Jika sudut A berpenyiku dengan sudut B dan $A=35^\circ$, maka $B=90^\circ-35^\circ=55^\circ$.
2. Jika sudut C berpelurus dengan sudut D dan $C=120^\circ$, maka $D=180^\circ-120^\circ=60^\circ$.

## Latihan
1. Sudut X berpenyiku dengan sudut Y. Jika X=48°, tentukan Y.
2. Sudut P berpelurus dengan sudut Q. Jika Q=73°, tentukan P.
3. Tentukan jenis sudut: 20°, 90°, 130°, 180°.

## Kunci Singkat
1) 42°  2) 107°  3) lancip, siku-siku, tumpul, lurus`,
    },
    {
      id: 'mat12',
      title: 'Segitiga dan Segiempat: Keliling & Luas',
      chapterId: chapter2.id,
      difficulty: 'MEDIUM',
      content: `# Segitiga dan Segiempat: Keliling & Luas

## Tujuan Belajar
- Menghitung keliling dan luas segitiga.
- Menghitung luas persegi, persegi panjang, jajargenjang, dan trapesium.

## Rumus Ringkas
### Segitiga
Keliling: jumlah sisi.
Luas:
$$L=\frac{1}{2}\times a \times t$$

### Persegi
$$L=s^2,\quad K=4s$$

### Persegi Panjang
$$L=p\times l,\quad K=2(p+l)$$

### Jajargenjang
$$L=a\times t$$

### Trapesium
$$L=\frac{1}{2}(a+b)\times t$$

## Contoh
Trapesium dengan sisi sejajar 10 cm dan 6 cm, tinggi 5 cm:
$$L=\frac{1}{2}(10+6)\times 5=40\text{ cm}^2$$

## Latihan
1. Segitiga alas 12 cm tinggi 8 cm. Luas?
2. Persegi panjang p=15 cm l=7 cm. Keliling?
3. Jajargenjang alas 9 cm tinggi 6 cm. Luas?

## Kunci Singkat
1) 48 cm²  2) 44 cm  3) 54 cm²`,
    },
    {
      id: 'mat13',
      title: 'Teorema Pythagoras',
      chapterId: chapter2.id,
      difficulty: 'MEDIUM',
      content: `# Teorema Pythagoras

## Tujuan Belajar
- Menggunakan Pythagoras untuk segitiga siku-siku.
- Menentukan panjang sisi miring atau sisi siku-siku.

## Konsep Inti
Untuk segitiga siku-siku dengan sisi siku-siku $a$ dan $b$, serta sisi miring $c$:
$$a^2+b^2=c^2$$

## Contoh 1
$a=6$, $b=8$.
$$c=\sqrt{6^2+8^2}=\sqrt{36+64}=\sqrt{100}=10$$

## Contoh 2
$c=13$, $a=5$.
$$b=\sqrt{13^2-5^2}=\sqrt{169-25}=\sqrt{144}=12$$

## Latihan
1. $a=9$, $b=12$, tentukan $c$.
2. $c=17$, $a=8$, tentukan $b$.
3. Apakah 7, 24, 25 membentuk segitiga siku-siku?

## Kunci Singkat
1) 15  2) 15  3) ya, karena $7^2+24^2=25^2$`,
    },
    {
      id: 'mat14',
      title: 'Bangun Ruang: Prisma & Limas (Volume dan Luas Permukaan)',
      chapterId: chapter2.id,
      difficulty: 'HARD',
      content: `# Bangun Ruang: Prisma & Limas

## Tujuan Belajar
- Menghitung volume prisma dan limas.
- Memahami ide luas permukaan sebagai jumlah luas sisi.

## Prisma
Prisma memiliki dua bidang alas kongruen dan sejajar.

Volume prisma:
$$V = L_{alas} \times t$$

## Limas
Limas memiliki satu alas dan sisi-sisi tegak berbentuk segitiga yang bertemu di puncak.

Volume limas:
$$V = \frac{1}{3} L_{alas} \times t$$

## Contoh
Prisma segitiga dengan $L_{alas}=24\text{ cm}^2$ dan tinggi prisma 10 cm:
$$V=24\times 10=240\text{ cm}^3$$

Limas dengan $L_{alas}=36\text{ cm}^2$ dan tinggi 9 cm:
$$V=\frac{1}{3}\times 36\times 9=108\text{ cm}^3$$

## Latihan
1. Prisma dengan $L_{alas}=30$ cm², tinggi 12 cm. Volume?
2. Limas dengan $L_{alas}=50$ cm², tinggi 6 cm. Volume?
3. Jelaskan dengan kalimatmu sendiri mengapa volume limas ada faktor $\frac{1}{3}$.

## Kunci Singkat
1) 360 cm³  2) 100 cm³  3) (jawaban konsep)`,
    },
    {
      id: 'mat15',
      title: 'Bangun Ruang: Tabung (Silinder) dan Kerucut',
      chapterId: chapter2.id,
      difficulty: 'HARD',
      content: `# Tabung (Silinder) dan Kerucut

## Tujuan Belajar
- Menghitung volume tabung dan kerucut.
- Menggunakan rumus luas permukaan tabung.

## Tabung
Volume:
$$V=\pi r^2 t$$

Luas permukaan:
$$L=2\pi r(r+t)$$

## Kerucut
Volume:
$$V=\frac{1}{3}\pi r^2 t$$

## Contoh
Tabung $r=7$ cm, $t=10$ cm:
$$V=\frac{22}{7}\cdot 7^2\cdot 10=1540\text{ cm}^3$$

## Latihan
1. Tabung $r=5$ cm, $t=12$ cm. Volume (pakai $\pi=3{,}14$)?
2. Kerucut $r=6$ cm, $t=9$ cm. Volume (pakai $\pi=3{,}14$)?
3. Tabung $r=3$ cm, $t=8$ cm. Luas permukaan (pakai $\pi=3{,}14$)?

## Kunci Singkat
1) 942 cm³  2) 339,12 cm³  3) 207,24 cm²`,
    },
    {
      id: 'mat16',
      title: 'Statistika Dasar: Mean, Median, Modus',
      chapterId: chapter4.id,
      difficulty: 'EASY',
      content: `# Statistika Dasar: Mean, Median, Modus

## Tujuan Belajar
- Menentukan rata-rata (mean), median, dan modus.
- Menafsirkan ukuran pemusatan data.

## Konsep Inti
Misal data: 2, 3, 3, 7, 10.
- Mean: jumlah data dibagi banyaknya data.
- Median: nilai tengah setelah diurutkan.
- Modus: nilai yang paling sering muncul.

## Contoh
Data: 4, 6, 6, 8, 10
- Mean: $(4+6+6+8+10)/5 = 34/5 = 6{,}8$
- Median: 6
- Modus: 6

## Latihan
1. Data: 5, 7, 9, 9, 10. Mean?
2. Data: 2, 4, 6, 8. Median?
3. Data: 1, 2, 2, 2, 5. Modus?

## Kunci Singkat
1) 8  2) 5  3) 2`,
    },
    {
      id: 'mat17',
      title: 'Penyajian Data: Tabel dan Diagram (Batang/Garis/Lingkaran)',
      chapterId: chapter4.id,
      difficulty: 'MEDIUM',
      content: `# Penyajian Data: Tabel dan Diagram

## Tujuan Belajar
- Mengubah data menjadi tabel frekuensi sederhana.
- Memilih diagram yang cocok (batang, garis, lingkaran).

## Konsep Inti
- Diagram batang: membandingkan kategori.
- Diagram garis: melihat perubahan terhadap waktu.
- Diagram lingkaran: melihat komposisi (persentase).

## Contoh
Data hobi 20 siswa: Sepak bola 8, Musik 6, Membaca 4, Lainnya 2.
- Persentase sepak bola: $8/20=40\%$.

Diagram lingkaran: sudut sektor sepak bola $=40\%\times 360^\circ=144^\circ$.

## Latihan
1. Total 50 siswa: 15 suka basket. Berapa persen?
2. Jika sektor diagram lingkaran 90°, berapa persen?
3. Kapan lebih tepat pakai diagram garis?

## Kunci Singkat
1) 30%  2) 25%  3) saat data berubah terhadap waktu`,
    },
    {
      id: 'mat18',
      title: 'Peluang Kejadian Sederhana',
      chapterId: chapter4.id,
      difficulty: 'MEDIUM',
      content: `# Peluang Kejadian Sederhana

## Tujuan Belajar
- Menghitung peluang dari percobaan sederhana.
- Menentukan ruang sampel dan kejadian.

## Konsep Inti
Peluang kejadian $A$:
$$P(A)=\frac{n(A)}{n(S)}$$
dengan $n(A)$ banyaknya hasil yang mendukung kejadian A, dan $n(S)$ banyaknya seluruh hasil (ruang sampel).

## Contoh
1) Lempar dadu: ruang sampel 6 hasil.
Peluang muncul angka genap (2,4,6):
$$P=\frac{3}{6}=\frac{1}{2}$$

2) Lempar koin: peluang muncul gambar = $1/2$.

## Latihan
1. Lempar dadu, peluang muncul 5?
2. Ambil 1 bola dari kotak berisi 3 merah, 2 biru. Peluang biru?
3. Lempar 2 koin, peluang muncul 2 gambar?

## Kunci Singkat
1) $1/6$  2) $2/5$  3) $1/4$`,
    },
    {
      id: 'mat19',
      title: 'Fungsi dan Grafik Sederhana',
      chapterId: chapter6.id,
      difficulty: 'HARD',
      content: `# Fungsi dan Grafik Sederhana

## Tujuan Belajar
- Memahami fungsi sebagai aturan pasangan input-output.
- Mengisi tabel nilai dan menggambar grafik sederhana.

## Konsep Inti
Fungsi $f(x)$ adalah aturan yang memetakan setiap $x$ ke tepat satu nilai $y$.

Contoh fungsi linear:
$$y=2x+1$$

## Langkah Membuat Grafik
1. Pilih beberapa nilai $x$ (mis. -2, -1, 0, 1, 2).
2. Hitung $y$ untuk tiap $x$.
3. Plot titik-titik $(x,y)$ lalu hubungkan.

## Contoh
Untuk $y=2x+1$:
- $x=0 \Rightarrow y=1$
- $x=1 \Rightarrow y=3$
- $x=2 \Rightarrow y=5$

## Latihan
1. Buat tabel nilai untuk $y=x-3$ (x: 0,1,2,3).
2. Titik potong sumbu-y dari $y=4x-2$?
3. Jika $y=3x+6$ dan $x=-2$, berapa $y$?

## Kunci Singkat
1) (0,-3),(1,-2),(2,-1),(3,0)  2) -2  3) 0`,
    },
    {
      id: 'mat20',
      title: 'Transformasi Geometri: Translasi, Refleksi, Rotasi, Dilatasi',
      chapterId: chapter6.id,
      difficulty: 'HARD',
      content: `# Transformasi Geometri

## Tujuan Belajar
- Mengenali empat transformasi dasar pada bidang.
- Menghitung koordinat bayangan titik setelah transformasi sederhana.

## Konsep Inti
Misal titik $P(x,y)$.

### 1) Translasi
Geser sejauh $(a,b)$:
$$P'(x+a, y+b)$$

### 2) Refleksi
- Terhadap sumbu-x: $(x,-y)$
- Terhadap sumbu-y: $(-x,y)$

### 3) Rotasi (pusat O)
- 90° berlawanan jarum jam: $(x,y)\to(-y,x)$
- 180°: $(x,y)\to(-x,-y)$

### 4) Dilatasi
Skala $k$ (pusat O):
$$P'(kx, ky)$$

## Contoh
Titik P(2,-1) ditranslasi (3,4) → P'(5,3).

## Latihan
1. Q(-3,2) direfleksi terhadap sumbu-y.
2. R(1,4) dirotasi 180° terhadap O.
3. S(2,3) didilatasi skala 2 terhadap O.

## Kunci Singkat
1) (3,2)  2) (-1,-4)  3) (4,6)`,
    },
  ];

  let createdOrUpdated = 0;
  for (const m of materials) {
    await prisma.material.upsert({
      where: { id: m.id },
      update: {
        title: m.title,
        chapterId: m.chapterId,
        difficulty: m.difficulty,
        content: m.content,
        contentVersion: sha256(m.content),
      },
      create: {
        id: m.id,
        title: m.title,
        chapterId: m.chapterId,
        difficulty: m.difficulty,
        content: m.content,
        contentVersion: sha256(m.content),
        imageUrl: null,
      },
    });
    createdOrUpdated++;
  }

  console.log(`✓ Seeded ${createdOrUpdated} materials (mat1..mat20)`);

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
