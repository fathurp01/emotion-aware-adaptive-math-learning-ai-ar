# Emotion Model Assets

Taruh model TensorFlow.js hasil training (MobileNetV2 transfer learning / fine-tuning) di folder ini.

## Default path yang dipakai aplikasi

- `public/model/tfjs_model/model.json`
- `public/model/tfjs_model/metadata.json`
- file bobot (biasanya) `public/model/group1-shard*.bin` atau `weights.bin`

Frontend akan load:
- Model: `/model/tfjs_model/model.json`
- Metadata: `/model/tfjs_model/metadata.json`

## Catatan penting

- File `.bin` harus berada di lokasi yang direferensikan oleh `model.json`.
  Biasanya semua file bobot berada di folder yang sama dengan `model.json`.
- `metadata.json` harus berisi `labels` dengan urutan yang sama persis seperti output model.

## Jika habis export dan model gagal load

Kadang hasil `tensorflowjs_converter` (terutama dari Keras v3) menghasilkan `model.json` dengan key `batch_shape` pada `InputLayer`, sementara `tfjs-layers` di browser butuh `batchInputShape`/`inputShape`.

Kalau di browser muncul error seperti:

`ValueError: An InputLayer should be passed either a batchInputShape or an inputShape`

jalankan ini (akan otomatis patch + cek file shard .bin ada):

```bash
npm run model:patch-tfjs
```

Contoh format metadata:

```json
{ "labels": ["Neutral","Happy","Anxious","Confused","Frustrated","Sad","Surprised"] }
```

## Override lokasi model (opsional)

Kamu bisa override URL/path via `.env`:

```env
NEXT_PUBLIC_EMOTION_MODEL_URL=/model/tfjs_model/model.json
NEXT_PUBLIC_EMOTION_METADATA_URL=/model/tfjs_model/metadata.json
# atau jika tidak ada metadata.json:
NEXT_PUBLIC_EMOTION_LABELS=Negative,Neutral,Positive
```
