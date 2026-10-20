// The only way pages get data. Every page draws four states besides its normal one: empty, loading, error and
// "not allowed" (denied). Add ?state=empty|loading|error|denied to any address to see a page in that state.

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router';
import { currentUser, signOut, subscribe } from '../auth';
import { NotAllowedError } from './errors';
import type { Person, Role } from './types';

export const PAGE_STATES = ['empty', 'loading', 'error', 'denied'] as const;
export type PageState = (typeof PAGE_STATES)[number];
export type Status = 'ready' | PageState;

export interface DataResult<T> {
  status: Status;
  /** Set when status is 'ready'. */
  data: T | undefined;
  /** Set when status is 'error'. */
  error: Error | undefined;
  /** Fetch again, for example after a save. */
  reload: () => void;
}

/** The screen being shown, from src/routes.ts. Set by the router so hooks can check roles. */
export const ScreenContext = createContext<{ id: string; roles: readonly Role[] } | null>(null);

/** The state forced with ?state=… on the address, if any. */
export function useForcedState(): PageState | null {
  const [params] = useSearchParams();
  const state = params.get('state');
  return PAGE_STATES.find((candidate) => candidate === state) ?? null;
}

/** The signed-in sample person, and a way to sign out. */
export function useCurrentUser(): { user: Person | null; signOut: () => void } {
  const user = useSyncExternalStore(subscribe, currentUser);
  return { user, signOut };
}

function isEmpty(data: unknown) {
  return data === null || data === undefined || (Array.isArray(data) && data.length === 0);
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

interface Settled<T> {
  request: string;
  data?: T;
  error?: Error;
}

/**
 * Calls a data function from src/data and tracks its state. Arguments must be plain values (ids, filters),
 * because they are compared by value: `useData(getItem, [id])`.
 */
export function useData<A extends unknown[], T>(fn: (...args: A) => Promise<T>, args: A): DataResult<T> {
  const forced = useForcedState();
  const screen = useContext(ScreenContext);
  const { user } = useCurrentUser();
  const [reloads, setReloads] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const reload = useCallback(() => setReloads((count) => count + 1), []);

  const routeDenied = Boolean(screen && screen.roles.length > 0 && (!user || !screen.roles.includes(user.role)));
  const skip = forced !== null || routeDenied;
  const argsKey = JSON.stringify(args);
  const request = `${fn.name}|${argsKey}|${reloads}|${user?.id ?? ''}`;

  useEffect(() => {
    if (skip) return;
    let live = true;
    fn(...(JSON.parse(argsKey) as A)).then(
      (data) => live && setSettled({ request, data }),
      (error: unknown) => live && setSettled({ request, error: toError(error) }),
    );
    return () => {
      live = false;
    };
  }, [fn, argsKey, request, skip]);

  const result = (status: Status, data?: T, error?: Error): DataResult<T> => ({ status, data, error, reload });

  if (forced === 'error')
    return result('error', undefined, new Error('Something went wrong (shown with ?state=error)'));
  if (forced) return result(forced);
  if (routeDenied) return result('denied');
  if (!settled || settled.request !== request) return result('loading');
  if (settled.error instanceof NotAllowedError) return result('denied');
  if (settled.error) return result('error', undefined, settled.error);
  if (isEmpty(settled.data)) return result('empty');
  return result('ready', settled.data);
}

export interface ActionResult<A extends unknown[], T> {
  /** Runs the action. Resolves to its result, or undefined if it failed (see error). */
  run: (...args: A) => Promise<T | undefined>;
  pending: boolean;
  error: Error | undefined;
  denied: boolean;
}

/** Wraps a data function that changes something, such as saveItem: `const save = useAction(saveItem)`. */
export function useAction<A extends unknown[], T>(fn: (...args: A) => Promise<T>): ActionResult<A, T> {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  const run = useCallback(
    async (...args: A) => {
      setPending(true);
      setError(undefined);
      try {
        return await fn(...args);
      } catch (caught) {
        setError(toError(caught));
        return undefined;
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  return { run, pending, error, denied: error instanceof NotAllowedError };
}
