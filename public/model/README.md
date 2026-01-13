# Emotion Model Assets

Place the trained TensorFlow.js model (MobileNetV2 transfer learning / fine-tuning) in this folder.

## Default path used by the application

- `public/model/tfjs_model/model.json`
- `public/model/tfjs_model/metadata.json`
- weight files (usually) `public/model/group1-shard*.bin` or `weights.bin`

Frontend will load:
- Model: `/model/tfjs_model/model.json`
- Metadata: `/model/tfjs_model/metadata.json`

## Important Notes

- `.bin` files must be in the location referenced by `model.json`.
  Usually all weight files are in the same folder as `model.json`.
- `metadata.json` must contain `labels` in the exact order as the model output.

## If export finishes and model fails to load

Sometimes `tensorflowjs_converter` output (especially from Keras v3) produces `model.json` with `batch_shape` key in `InputLayer`, while `tfjs-layers` in browser needs `batchInputShape`/`inputShape`.

If errors like this appear in the browser:

`ValueError: An InputLayer should be passed either a batchInputShape or an inputShape`

run this (will automatically patch + check shard .bin exists):

```bash
npm run model:patch-tfjs
```

Metadata format example:

```json
{ "labels": ["Neutral","Happy","Anxious","Confused","Frustrated","Sad","Surprised"] }
```

## Override model location (optional)

You can override URL/path via `.env`:

```env
NEXT_PUBLIC_EMOTION_MODEL_URL=/model/tfjs_model/model.json
NEXT_PUBLIC_EMOTION_METADATA_URL=/model/tfjs_model/metadata.json
# or if metadata.json is missing:
NEXT_PUBLIC_EMOTION_LABELS=Negative,Neutral,Positive
```
