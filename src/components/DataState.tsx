import type { ReactNode } from 'react';
import type { DataResult } from '../data/hooks';

interface DataStateProps<T> {
  result: DataResult<T>;
  /** Drawn when the data has loaded and there is something to show. */
  children: (data: NonNullable<T>) => ReactNode;
  empty?: ReactNode;
  loading?: ReactNode;
  error?: (error: Error, retry: () => void) => ReactNode;
  denied?: ReactNode;
}

/**
 * Draws a page's four states (empty, loading, error, not allowed) around its normal content.
 * The defaults are plain; give the page's own wording, or restyle these from the design's states page.
 */
export function DataState<T>({ result, children, empty, loading, error, denied }: DataStateProps<T>) {
  switch (result.status) {
    case 'loading':
      return (
        loading ?? (
          <div className="state state-loading" role="status">
            Loading…
          </div>
        )
      );
    case 'empty':
      return empty ?? <div className="state state-empty">Nothing here yet.</div>;
    case 'error':
      return error ? (
        error(result.error ?? new Error('Something went wrong'), result.reload)
      ) : (
        <div className="state state-error" role="alert">
          <p>Something went wrong.</p>
          <button type="button" onClick={result.reload}>
            Try again
          </button>
        </div>
      );
    case 'denied':
      return denied ?? <div className="state state-denied">You don’t have access to this.</div>;
    case 'ready':
      return <>{children(result.data as NonNullable<T>)}</>;
  }
}
