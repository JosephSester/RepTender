import { isValid, parseISO } from 'date-fns';
import type { Pet, Photo } from '../domain/types';
import { dateKey } from '../domain/dates';
import { blobToDataUrl, dataUrlToBlob, IMPORTABLE_IMAGE_TYPE } from '../lib/base64';
import { db, DEFAULT_SETTINGS, SCHEMA_VERSION } from './db';
import { updateSettings } from './settings';
import { BackupError, TABLE_NAMES, validateTables, type BackupTables, type TableName } from './backupSchema';

export const BACKUP_APP = 'RepTender';

export type PhotoJson = Omit<Photo, 'blob' | 'thumbBlob'> & { blob: string; thumbBlob: string };

/** The backup file (spec §9). */
export interface BackupJson {
  app: typeof BACKUP_APP;
  schemaVersion: number;
  exportedAt: string;
  tables: Omit<BackupTables, 'photos'> & { photos: PhotoJson[] };
}

/** A validated, migrated backup with its photos decoded, ready for restoreBackup(). */
export interface ParsedBackup {
  schemaVersion: number;
  exportedAt: string;
  tables: BackupTables;
}

export interface BackupSummary {
  pets: number;
  entries: number;
  photos: number;
}

/** Every table, read in one transaction so the snapshot is consistent. */
export async function readAllTables(): Promise<BackupTables> {
  return db.transaction('r', db.tables, async () => {
    const out = {} as Record<TableName, unknown[]>;
    for (const name of TABLE_NAMES) out[name] = await db.table(name).toArray();
    return out as unknown as BackupTables;
  });
}

/**
 * Drops rows whose owner is gone and strips dangling optional links (a deleted parent pet, a
 * missing photo), so an export always passes the import's reference checks.
 */
export function pruneOrphans(t: BackupTables): BackupTables {
  const pets = new Set(t.pets.map((p) => p.id));
  const photos = new Set(t.photos.map((p) => p.id));
  const owned = <T extends { petId: string }>(rows: T[]) => rows.filter((r) => pets.has(r.petId));
  const feedings = owned(t.feedings);
  const feedingPet = new Map(feedings.map((f) => [f.id, f.petId]));
  const careTasks = t.careTasks.filter((c) => !c.petId || pets.has(c.petId));
  const taskIds = new Set(careTasks.map((c) => c.id));
  const parent = (p: Pet['sire']) => (p?.petId && !pets.has(p.petId) ? { name: p.name, morph: p.morph } : p);
  return {
    ...t,
    pets: t.pets.map((p) => ({
      ...p,
      photoId: p.photoId && photos.has(p.photoId) ? p.photoId : undefined,
      sire: parent(p.sire),
      dam: parent(p.dam),
    })),
    feedings,
    regurgitations: owned(t.regurgitations).filter((r) => feedingPet.get(r.feedingId) === r.petId),
    sheds: owned(t.sheds),
    poops: owned(t.poops),
    measurements: owned(t.measurements),
    habitatReadings: owned(t.habitatReadings),
    careTasks,
    careCompletions: t.careCompletions.filter((c) => taskIds.has(c.taskId)),
    vetVisits: owned(t.vetVisits).map((v) => ({ ...v, photoIds: v.photoIds.filter((id) => photos.has(id)) })),
    notes: owned(t.notes),
  };
}

/** Import accepts only jpeg/png/webp/gif data URLs, so a photo blob stored with any other type is labelled as a JPEG. */
const imageBlob = (b: Blob): Blob => (IMPORTABLE_IMAGE_TYPE.test(b.type) ? b : new Blob([b], { type: 'image/jpeg' }));

async function encodePhoto(p: Photo): Promise<PhotoJson> {
  return { ...p, blob: await blobToDataUrl(imageBlob(p.blob)), thumbBlob: await blobToDataUrl(imageBlob(p.thumbBlob)) };
}

export interface BackupResult {
  backup: BackupJson;
  /** Photos whose bytes couldn't be read; they (and links to them) are left out of the backup. */
  skippedPhotos: number;
}

/**
 * Builds the backup. A photo that can't be read (WebKit can lose stored Blobs) is skipped rather than
 * failing the whole backup; links to it are removed from the exported copy only, never from the database.
 */
export async function buildBackup(now: Date = new Date()): Promise<BackupResult> {
  const tables = pruneOrphans(await readAllTables());
  // Encoding is async (Blob reads), so it runs after the read transaction has finished.
  // One photo at a time keeps peak memory low on a phone (each photo is a Blob, a byte copy and a string).
  const encoded = new Map<string, PhotoJson>();
  for (const p of tables.photos) {
    try {
      encoded.set(p.id, await encodePhoto(p));
    } catch {
      // unreadable: skipped below
    }
  }
  const readable = tables.photos.filter((p) => encoded.has(p.id));
  const skippedPhotos = tables.photos.length - readable.length;
  // Re-prune so pet.photoId / vetVisit.photoIds pointing at a skipped photo don't make the file fail its own import.
  const kept = skippedPhotos > 0 ? pruneOrphans({ ...tables, photos: readable }) : tables;
  const photos = readable.map((p) => encoded.get(p.id)!);
  return {
    backup: { app: BACKUP_APP, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), tables: { ...kept, photos } },
    skippedPhotos,
  };
}

export async function createBackup(now: Date = new Date()): Promise<BackupJson> {
  return (await buildBackup(now)).backup;
}

export const backupFileName = (now: Date): string => `reptender-backup-${dateKey(now)}.json`;

export async function createBackupFile(now: Date = new Date()): Promise<{ file: File; skippedPhotos: number }> {
  const { backup, skippedPhotos } = await buildBackup(now);
  return { file: new File([JSON.stringify(backup)], backupFileName(now), { type: 'application/json' }), skippedPhotos };
}

/** Spec §9: record lastBackupAt once the file has been handed to the share sheet or downloaded. */
export async function markBackedUp(at: Date = new Date()): Promise<void> {
  await updateSettings({ lastBackupAt: at.toISOString() });
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Parses and validates a backup file's text. Throws BackupError; never touches the database. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't a RepTender backup (it isn't valid JSON).");
  }
  if (!isObject(json) || json.app !== BACKUP_APP) throw new BackupError("That file isn't a RepTender backup.");
  const version = json.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new BackupError('This backup has an unknown schema version.');
  }
  if (version > SCHEMA_VERSION) {
    throw new BackupError('This backup comes from a newer version of RepTender. Update the app, then import it again.');
  }
  if (typeof json.exportedAt !== 'string' || !isValid(parseISO(json.exportedAt))) {
    throw new BackupError('This backup has no valid export date.');
  }
  if (!isObject(json.tables)) throw new BackupError('This backup has no tables.');

  const tables = validateTables(json.tables, version);
  const photos = (tables.photos as unknown as PhotoJson[]).map((p, i) => {
    const blob = dataUrlToBlob(p.blob);
    const thumbBlob = dataUrlToBlob(p.thumbBlob);
    if (!blob) throw new BackupError(`Row ${i + 1} of photos: "blob" is missing or not valid.`);
    if (!thumbBlob) throw new BackupError(`Row ${i + 1} of photos: "thumbBlob" is missing or not valid.`);
    return { ...p, blob, thumbBlob };
  });
  return { schemaVersion: version, exportedAt: json.exportedAt, tables: { ...tables, photos } };
}

const ENTRY_TABLES = [
  'feedings', 'regurgitations', 'sheds', 'poops', 'measurements', 'habitatReadings', 'careCompletions', 'vetVisits', 'notes',
] as const;

export function summarizeBackup(b: ParsedBackup): BackupSummary {
  return {
    pets: b.tables.pets.length,
    entries: ENTRY_TABLES.reduce((n, name) => n + b.tables[name].length, 0),
    photos: b.tables.photos.length,
  };
}

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "4 pets, 120 entries, 6 photos" */
export function summaryText(s: BackupSummary): string {
  return [count(s.pets, 'pet', 'pets'), count(s.entries, 'entry', 'entries'), count(s.photos, 'photo', 'photos')].join(', ');
}

/** Spec §9: replace all data in one transaction. Any failure leaves the current data as it was. */
export async function restoreBackup(b: ParsedBackup): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    for (const table of db.tables) await table.clear();
    for (const name of TABLE_NAMES) {
      if (name === 'settings') continue;
      const rows = b.tables[name];
      if (rows.length > 0) await db.table(name).bulkAdd(rows);
    }
    await db.settings.put({ ...DEFAULT_SETTINGS, ...b.tables.settings[0], id: 'settings', lastBackupAt: b.exportedAt });
  });
}
