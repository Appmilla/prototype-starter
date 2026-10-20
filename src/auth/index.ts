// Pretend sign-in: choose a sample person, one per role. The production app replaces this folder with real
// sign-in and keeps the same three calls: currentUser(), role() and signOut().

import { samplePeople } from '../data/mock/people';
import type { Person, Role } from '../data/types';

const STORAGE_KEY = 'prototype-signed-in';
const listeners = new Set<() => void>();

function storedId(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

let memory = storedId();

function store(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage blocked: sign-in lasts until the next reload.
  }
  memory = id;
  listeners.forEach((listener) => listener());
}

/** The sample people the sign-in screen offers, one per role. */
export function people(): Person[] {
  return samplePeople;
}

export function currentUser(): Person | null {
  return samplePeople.find((person) => person.id === memory) ?? null;
}

export function role(): Role | null {
  return currentUser()?.role ?? null;
}

export function signIn(personId: string) {
  store(personId);
}

/** Signs in as the sample person for a role. Returns false if there is no such role. */
export function signInAs(roleName: string): boolean {
  const person = samplePeople.find((candidate) => candidate.role === roleName);
  if (person) store(person.id);
  return Boolean(person);
}

export function signOut() {
  store(null);
}

/** For useSyncExternalStore: call listener whenever the signed-in person changes. */
export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
