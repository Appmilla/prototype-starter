// In-memory store of made-up records. It lasts for the browser session, so changes survive moving between
// pages and reloading, until "Reset demo data" on /screens puts the seed records back.

import { role } from '../../auth';
import { NotAllowedError } from '../errors';
import type { Role } from '../types';

const STORAGE_KEY = 'prototype-demo-data';

type Snapshot = Record<string, unknown[]>;

let snapshot: Snapshot | null = null;

function load(): Snapshot {
  if (snapshot) return snapshot;
  try {
    snapshot = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '{}') as Snapshot;
  } catch {
    snapshot = {};
  }
  return snapshot;
}

function persist() {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage can be full or blocked; the data still lives in memory for this page.
  }
}

export interface Table<T extends { id: string }> {
  list(): T[];
  get(id: string): T | undefined;
  save(record: T): T;
  remove(id: string): void;
}

/** A named table of records, seeded with made-up data the first time it is used in a session. */
export function table<T extends { id: string }>(name: string, seed: () => T[]): Table<T> {
  const rows = (): T[] => {
    const data = load();
    if (!data[name]) {
      data[name] = structuredClone(seed());
      persist();
    }
    return data[name] as T[];
  };
  return {
    list: () => structuredClone(rows()),
    get: (id) => structuredClone(rows().find((row) => row.id === id)),
    save(record) {
      const all = rows();
      const index = all.findIndex((row) => row.id === record.id);
      if (index === -1) all.push(structuredClone(record));
      else all[index] = structuredClone(record);
      persist();
      return structuredClone(record);
    },
    remove(id) {
      const all = rows();
      const index = all.findIndex((row) => row.id === id);
      if (index !== -1) all.splice(index, 1);
      persist();
    },
  };
}

/** Puts every table back to its seed records. */
export function resetDemoData() {
  snapshot = {};
  persist();
}

/** A short pause, so loading states show as they would against a real API. */
export function delay(ms = 400) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Throws NotAllowedError unless the signed-in person has one of these roles. */
export function allow(...roles: Role[]) {
  const current = role();
  if (!current || !roles.includes(current)) throw new NotAllowedError();
}

/** A new id for a made-up record. */
export function newId() {
  return Math.random().toString(36).slice(2, 10);
}
