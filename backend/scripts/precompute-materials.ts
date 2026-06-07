import { precomputeMaterialContent } from '../lib/materialPrecompute';

async function main() {
  const limitRaw = process.env.MATERIAL_PRECOMPUTE_LIMIT;
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 500;

  const res = await precomputeMaterialContent({
    limit: Number.isFinite(limit) ? limit : 500,
    force: /^(1|true|yes)$/i.test(String(process.env.MATERIAL_PRECOMPUTE_FORCE || '')),
  });

  // eslint-disable-next-line no-console
  console.log(`OK: updated=${res.updated} skipped=${res.skipped} errors=${res.errors}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('FAILED:', err);
  process.exit(1);
});
