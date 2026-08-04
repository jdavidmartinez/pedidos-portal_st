export const BLOB_ORPHAN_RETENTION_DAYS = 30;
export const MANAGED_BLOB_PREFIXES = ["menu-products/", "campaigns/"] as const;

export interface ManagedBlob {
  pathname: string;
  url: string;
  size: number;
  uploadedAt: Date;
}

export interface BlobInventoryItem extends ManagedBlob {
  referenceCount: number;
  orphaned: boolean;
  eligibleForDeletion: boolean;
  orphanedDays: number;
}

export function normalizeBlobUrl(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function buildBlobInventory(
  blobs: ManagedBlob[],
  referenceCounts: Map<string, number>,
  orphanFirstSeen: Map<string, Date>,
  now = new Date(),
  retentionDays = BLOB_ORPHAN_RETENTION_DAYS
): BlobInventoryItem[] {
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;

  return blobs.map((blob) => {
    const normalizedUrl = normalizeBlobUrl(blob.url);
    const referenceCount = referenceCounts.get(normalizedUrl) ?? 0;
    const orphaned = referenceCount === 0;
    const firstSeen = orphanFirstSeen.get(normalizedUrl);
    const orphanedMs = firstSeen ? Math.max(0, now.getTime() - firstSeen.getTime()) : 0;

    return {
      ...blob,
      referenceCount,
      orphaned,
      eligibleForDeletion: orphaned && Boolean(firstSeen) && orphanedMs >= retentionMs,
      orphanedDays: Math.floor(orphanedMs / (24 * 60 * 60 * 1000)),
    };
  });
}
