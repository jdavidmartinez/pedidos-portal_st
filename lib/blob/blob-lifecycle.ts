import "server-only";

import { del, list } from "@vercel/blob";
import { getSql } from "@/lib/db/neon";
import {
  BLOB_ORPHAN_RETENTION_DAYS,
  buildBlobInventory,
  MANAGED_BLOB_PREFIXES,
  normalizeBlobUrl,
  type BlobInventoryItem,
  type ManagedBlob,
} from "@/lib/blob/blob-lifecycle-policy";

async function listManagedBlobs() {
  const blobs: ManagedBlob[] = [];

  for (const prefix of MANAGED_BLOB_PREFIXES) {
    let cursor: string | undefined;
    do {
      const page = await list({ prefix, limit: 1000, cursor });
      blobs.push(...page.blobs.map((blob) => ({
        pathname: blob.pathname,
        url: blob.url,
        size: blob.size,
        uploadedAt: new Date(blob.uploadedAt),
      })));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
  }

  return blobs;
}

async function getReferenceCounts() {
  const sql = getSql();
  const rows = (await sql`
    SELECT image_url
    FROM menu_products
    WHERE image_url IS NOT NULL AND image_url <> ''
    UNION ALL
    SELECT image_url
    FROM campaigns
    WHERE image_url IS NOT NULL AND image_url <> ''
  `) as unknown as Array<{ image_url: string }>;
  const counts = new Map<string, number>();

  for (const row of rows) {
    const url = normalizeBlobUrl(row.image_url);
    counts.set(url, (counts.get(url) ?? 0) + 1);
  }

  return counts;
}

async function syncOrphanObservations(blobs: ManagedBlob[], referenceCounts: Map<string, number>) {
  const sql = getSql();
  const orphaned = blobs.filter((blob) => !referenceCounts.has(normalizeBlobUrl(blob.url)));
  const orphanUrls = new Set(orphaned.map((blob) => normalizeBlobUrl(blob.url)));
  const existing = (await sql`
    SELECT url, first_seen_at
    FROM blob_orphan_observations
  `) as unknown as Array<{ url: string; first_seen_at: string | Date }>;
  const stale = existing.filter((row) => !orphanUrls.has(row.url));

  const statements = [
    ...orphaned.map((blob) => sql`
      INSERT INTO blob_orphan_observations (url, pathname)
      VALUES (${normalizeBlobUrl(blob.url)}, ${blob.pathname})
      ON CONFLICT (url) DO UPDATE
      SET pathname = EXCLUDED.pathname, last_seen_at = now()
    `),
    ...stale.map((row) => sql`DELETE FROM blob_orphan_observations WHERE url = ${row.url}`),
  ];
  if (statements.length > 0) await sql.transaction(statements);

  const observations = (await sql`
    SELECT url, first_seen_at
    FROM blob_orphan_observations
  `) as unknown as Array<{ url: string; first_seen_at: string | Date }>;

  return new Map(observations.map((row) => [
    row.url,
    row.first_seen_at instanceof Date ? row.first_seen_at : new Date(row.first_seen_at),
  ]));
}

export interface BlobCleanupReport {
  retentionDays: number;
  generatedAt: string;
  totalManaged: number;
  referenced: number;
  orphaned: number;
  eligibleForDeletion: number;
  reclaimableBytes: number;
  items: BlobInventoryItem[];
}

export async function getBlobCleanupReport(): Promise<BlobCleanupReport> {
  const blobs = await listManagedBlobs();
  const referenceCounts = await getReferenceCounts();
  const firstSeen = await syncOrphanObservations(blobs, referenceCounts);
  const items = buildBlobInventory(blobs, referenceCounts, firstSeen);
  const eligible = items.filter((item) => item.eligibleForDeletion);

  return {
    retentionDays: BLOB_ORPHAN_RETENTION_DAYS,
    generatedAt: new Date().toISOString(),
    totalManaged: items.length,
    referenced: items.filter((item) => !item.orphaned).length,
    orphaned: items.filter((item) => item.orphaned).length,
    eligibleForDeletion: eligible.length,
    reclaimableBytes: eligible.reduce((total, item) => total + item.size, 0),
    items,
  };
}

export async function deleteEligibleOrphanedBlobs() {
  const report = await getBlobCleanupReport();
  const urls = report.items
    .filter((item) => item.eligibleForDeletion)
    .map((item) => item.url);

  if (urls.length > 0) await del(urls);
  return { deleted: urls.length, urls };
}
