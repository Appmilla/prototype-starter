// The route table: every screen in the prototype, one entry each. /screens and the screen map are built from it.
//
// An entry looks like this (the page is imported at the top of the file):
//
//   import AssessResult from './pages/AssessResult';
//
//   {
//     id: 'assess-result',
//     path: '/assessments/:id',
//     example: '/assessments/a1',
//     page: AssessResult,
//     title: 'Assessment',
//     designScreen: 'assess-result',
//     roles: ['member'],
//     states: ['empty', 'loading', 'error', 'denied'],
//   },

import type { ComponentType } from 'react';
import type { PageState } from './data/hooks';
import type { Role } from './data/types';

export interface ScreenRoute {
  /** Stable id for the screen; usually the same as designScreen. */
  id: string;
  /** Address pattern, with :params for ids. Use '/' for the first screen. */
  path: string;
  /** A real address to open from /screens when the path has :params, using a made-up record's id. */
  example?: string;
  page: ComponentType;
  /** Shown in the browser tab and on /screens. */
  title: string;
  /** The screen's name in the Claude Design handoff, or null if it was added without a design. */
  designScreen: string | null;
  /** Who may see the screen. Empty means anyone, without signing in. */
  roles: Role[];
  /** The states the page draws. Every page draws all four. */
  states: PageState[];
}

export const routes: ScreenRoute[] = [];
