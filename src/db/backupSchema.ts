import { isValid, parseISO } from 'date-fns';
import type {
  CareCompletion, CareTask, Feeding, FoodItem, HabitatReading, Measurement, Note, Pet, Photo, Poop,
  Regurgitation, Settings, Shed, VetVisit,
} from '../domain/types';
import { isDateKey, isTimeOfDay } from '../domain/dates';

/** A backup file that can't be imported. `message` is shown to the user as is. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface BackupTables {
  pets: Pet[];
  feedings: Feeding[];
  regurgitations: Regurgitation[];
  photos: Photo[];
  foodItems: FoodItem[];
  settings: Settings[];
  sheds: Shed[];
  poops: Poop[];
  measurements: Measurement[];
  habitatReadings: HabitatReading[];
  careTasks: CareTask[];
  careCompletions: CareCompletion[];
  vetVisits: VetVisit[];
  notes: Note[];
}

export type TableName = keyof BackupTables;

/** Every Dexie table (schema version 2). */
export const TABLE_NAMES: readonly TableName[] = [
  'pets', 'feedings', 'regurgitations', 'photos', 'foodItems', 'settings', 'sheds', 'poops',
  'measurements', 'habitatReadings', 'careTasks', 'careCompletions', 'vetVisits', 'notes',
];

/** The tables a schema version 1 (Plan 1) backup has. */
export const V1_TABLE_NAMES: readonly TableName[] = ['pets', 'feedings', 'regurgitations', 'photos', 'foodItems', 'settings'];

/** A validator. Object validators also carry `clean`, which drops null sub-fields ("not set"). */
type Check = ((v: unknown) => boolean) & { clean?: (v: unknown) => unknown };
interface Field {
  check: Check;
  optional: boolean;
}
type Fields = Record<string, Field>;

const req = (check: Check): Field => ({ check, optional: false });
const opt = (check: Check): Field => ({ check, optional: true });

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str: Check = (v) => typeof v === 'string';
const text: Check = (v) => typeof v === 'string' && v.trim() !== '';
const bool: Check = (v) => typeof v === 'boolean';
const num: Check = (v) => typeof v === 'number' && Number.isFinite(v);
const count: Check = (v) => Number.isInteger(v) && (v as number) >= 1;
const iso: Check = (v) => typeof v === 'string' && isValid(parseISO(v));
const day: Check = (v) => typeof v === 'string' && isDateKey(v);
const time: Check = (v) => typeof v === 'string' && isTimeOfDay(v);
const dataUrl: Check = (v) => typeof v === 'string' && v.startsWith('data:'); // decoded (and checked) in backup.ts
const oneOf = (...values: string[]): Check => (v) => typeof v === 'string' && values.includes(v);
const listOf = (check: Check): Check => (v) => Array.isArray(v) && v.every(check);
const shape = (fields: Fields): Check => {
  const check: Check = (v) => isObject(v) && Object.entries(fields).every(([k, f]) => fieldOk(v[k], f));
  check.clean = (v) => cleanFields(v as Record<string, unknown>, fields);
  return check;
};

/** A copy of `row` with null optional fields removed, at every nesting level the spec describes. */
function cleanFields(row: Record<string, unknown>, fields: Fields): Record<string, unknown> {
  const clean: Record<string, unknown> = { ...row };
  for (const [key, field] of Object.entries(fields)) {
    if (row[key] === null) delete clean[key];
    else if (row[key] !== undefined && field.check.clean) clean[key] = field.check.clean(row[key]);
  }
  return clean;
}

function fieldOk(value: unknown, field: Field): boolean {
  if (value === undefined || value === null) return field.optional;
  return field.check(value);
}

const RECORD: Fields = { id: req(text), createdAt: req(iso), updatedAt: req(iso) };
const PARENT = shape({ name: opt(str), morph: opt(str), petId: opt(str) });
const TARGETS = shape({
  warmMinC: opt(num), warmMaxC: opt(num), coolMinC: opt(num), coolMaxC: opt(num), humidityMin: opt(num), humidityMax: opt(num),
});

interface TableSpec {
  fields: Fields;
  /** At least one of these must be set (spec §6.2 measurements and habitat readings). */
  atLeastOne?: string[];
}

const SPECS: Record<TableName, TableSpec> = {
  pets: {
    fields: {
      ...RECORD, name: req(text), photoId: opt(text), species: req(str), morph: opt(str),
      sex: req(oneOf('male', 'female', 'unknown')), birthDate: opt(day), birthDateApprox: req(bool),
      description: opt(str), origin: req(oneOf('captive_bred', 'wild_caught', 'unknown')), acquiredFrom: opt(str),
      acquiredDate: opt(day), pricePaid: opt(num), sire: opt(PARENT), dam: opt(PARENT), feedingIntervalDays: req(count),
      usualFoodItem: opt(str), usualQuantity: req(count), usualFeedTime: opt(time), enclosureLabel: opt(str),
      habitatTargets: req(TARGETS), nextFeedingOverride: opt(iso), inBlueSince: opt(day), archivedAt: opt(iso),
    },
  },
  feedings: {
    fields: {
      ...RECORD, petId: req(text), at: req(iso), foodItem: req(str), quantity: req(count),
      outcome: req(oneOf('ate', 'refused')), notes: opt(str),
    },
  },
  regurgitations: {
    fields: { ...RECORD, petId: req(text), at: req(iso), feedingId: req(text), pushBackDays: opt(count), notes: opt(str) },
  },
  photos: { fields: { ...RECORD, blob: req(dataUrl), thumbBlob: req(dataUrl), width: req(num), height: req(num) } },
  foodItems: { fields: { ...RECORD, name: req(text), isCustom: req(bool) } },
  settings: {
    fields: {
      id: req(oneOf('settings')), theme: req(oneOf('light', 'dark', 'auto')), tempUnit: req(oneOf('F', 'C')),
      weightUnit: req(oneOf('g', 'oz', 'lb')), lengthUnit: req(oneOf('in', 'cm')), lastBackupAt: opt(iso),
    },
  },
  sheds: {
    fields: {
      ...RECORD, petId: req(text), date: req(day), inBlueDate: opt(day),
      quality: req(oneOf('complete', 'partial', 'stuck')), notes: opt(str),
    },
  },
  poops: {
    fields: {
      ...RECORD, petId: req(text), at: req(iso), kind: req(oneOf('normal', 'runny', 'urate_only', 'abnormal')), notes: opt(str),
    },
  },
  measurements: {
    fields: { ...RECORD, petId: req(text), date: req(day), weightG: opt(num), lengthMm: opt(num) },
    atLeastOne: ['weightG', 'lengthMm'],
  },
  habitatReadings: {
    fields: { ...RECORD, petId: req(text), at: req(iso), warmC: opt(num), coolC: opt(num), humidityPct: opt(num) },
    atLeastOne: ['warmC', 'coolC', 'humidityPct'],
  },
  careTasks: {
    fields: {
      ...RECORD, petId: opt(text), name: req(text), intervalDays: req(count), timeOfDay: opt(time), archivedAt: opt(iso),
    },
  },
  careCompletions: { fields: { ...RECORD, taskId: req(text), at: req(iso) } },
  vetVisits: {
    fields: {
      ...RECORD, petId: req(text), date: req(day), clinic: opt(str), vet: opt(str), phone: opt(str), reason: opt(str),
      notes: opt(str), cost: opt(num), photoIds: req(listOf(text)), nextAppointment: opt(iso),
    },
  },
  notes: { fields: { ...RECORD, petId: req(text), at: req(iso), text: req(str) } },
};

const fail = (table: string, row: number, message: string): never => {
  throw new BackupError(`Row ${row + 1} of ${table}${message}`);
};

/** Checks one table's rows and returns them with null optional fields removed. */
function checkRows(name: TableName, rows: unknown[]): Record<string, unknown>[] {
  const spec = SPECS[name];
  const ids = new Set<string>();
  return rows.map((row, i) => {
    if (!isObject(row)) return fail(name, i, ' is not a record.');
    for (const [key, field] of Object.entries(spec.fields)) {
      if (!fieldOk(row[key], field)) fail(name, i, `: "${key}" is missing or not valid.`);
    }
    if (spec.atLeastOne && spec.atLeastOne.every((k) => row[k] === undefined || row[k] === null)) {
      fail(name, i, ` needs at least one of ${spec.atLeastOne.join(', ')}.`);
    }
    const id = String(row.id);
    if (ids.has(id)) fail(name, i, ': "id" is used twice.');
    ids.add(id);
    return cleanFields(row, spec.fields);
  });
}

/** Spec §9: "references that point to real records". */
function checkReferences(t: BackupTables): void {
  const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id));
  const pets = ids(t.pets);
  const photos = ids(t.photos);
  const tasks = ids(t.careTasks);
  const feedings = new Map(t.feedings.map((f) => [f.id, f]));
  const missing = (table: string, row: number, field: string) =>
    fail(table, row, `: "${field}" points to a record that isn't in the backup.`);

  t.pets.forEach((p, i) => {
    if (p.photoId && !photos.has(p.photoId)) missing('pets', i, 'photoId');
    if (p.sire?.petId && !pets.has(p.sire.petId)) missing('pets', i, 'sire');
    if (p.dam?.petId && !pets.has(p.dam.petId)) missing('pets', i, 'dam');
  });
  for (const name of ['feedings', 'regurgitations', 'sheds', 'poops', 'measurements', 'habitatReadings', 'vetVisits', 'notes'] as const) {
    (t[name] as { petId: string }[]).forEach((r, i) => {
      if (!pets.has(r.petId)) missing(name, i, 'petId');
    });
  }
  t.regurgitations.forEach((r, i) => {
    if (feedings.get(r.feedingId)?.petId !== r.petId) missing('regurgitations', i, 'feedingId');
  });
  t.careTasks.forEach((c, i) => {
    if (c.petId && !pets.has(c.petId)) missing('careTasks', i, 'petId');
  });
  t.careCompletions.forEach((c, i) => {
    if (!tasks.has(c.taskId)) missing('careCompletions', i, 'taskId');
  });
  t.vetVisits.forEach((v, i) => {
    if (v.photoIds.some((id) => !photos.has(id))) missing('vetVisits', i, 'photoIds');
  });
  const names = new Set<string>();
  t.foodItems.forEach((f, i) => {
    if (names.has(f.name)) fail('foodItems', i, ': "name" is used twice.');
    names.add(f.name);
  });
  if (t.settings.length > 1) fail('settings', 1, ': there can only be one settings record.');
}

/**
 * Validates the `tables` object of a backup with the given schema version and migrates it to the
 * current shape. Photo blobs are still data URL strings here. Throws BackupError.
 */
export function validateTables(raw: Record<string, unknown>, schemaVersion: number): BackupTables {
  const required = schemaVersion === 1 ? V1_TABLE_NAMES : TABLE_NAMES;
  const out = {} as Record<TableName, Record<string, unknown>[]>;
  for (const name of TABLE_NAMES) {
    const rows = raw[name];
    if (rows === undefined && !required.includes(name)) {
      out[name] = []; // schema 1 → 2: the husbandry tables start empty
      continue;
    }
    if (!Array.isArray(rows)) throw new BackupError(`This backup is missing the ${name} table.`);
    if (schemaVersion === 1 && name === 'pets') {
      // Same as the Dexie v1 → v2 upgrade: every pet gets a habitatTargets object.
      out[name] = checkRows(name, rows.map((p) => (isObject(p) && !p.habitatTargets ? { ...p, habitatTargets: {} } : p)));
    } else {
      out[name] = checkRows(name, rows);
    }
  }
  const tables = out as unknown as BackupTables;
  checkReferences(tables);
  return tables;
}
