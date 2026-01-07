# Emotion Model Assets

Taruh model TensorFlow.js hasil training (MobileNetV2 transfer learning / fine-tuning) di folder ini.

## Default path yang dipakai aplikasi

- `public/model/model.json`
- `public/model/metadata.json`
- file bobot (biasanya) `public/model/group1-shard*.bin` atau `weights.bin`

Frontend akan load:
- Model: `/model/model.json`
- Metadata: `/model/metadata.json`

## Catatan penting

- File `.bin` harus berada di lokasi yang direferensikan oleh `model.json`.
  Biasanya semua file bobot berada di folder yang sama dengan `model.json`.
- `metadata.json` harus berisi `labels` dengan urutan yang sama persis seperti output model.

Contoh format metadata:

```json
{ "labels": ["Neutral","Happy","Anxious","Confused","Frustrated","Sad","Surprised"] }
```

## Override lokasi model (opsional)

Kamu bisa override URL/path via `.env`:

```env
NEXT_PUBLIC_EMOTION_MODEL_URL=/model/model.json
NEXT_PUBLIC_EMOTION_METADATA_URL=/model/metadata.json
# atau jika tidak ada metadata.json:
NEXT_PUBLIC_EMOTION_LABELS=Neutral,Happy,Anxious,Confused,Frustrated,Sad,Surprised
```
