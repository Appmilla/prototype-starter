// Business types, each defined once. Pages, data functions and made-up records all use these,
// and the production app copies this file as its starting point.

/** The roles a person can sign in as. Claude replaces the placeholder with the roles in the design. */
export type Role = 'member';

/** Someone who can sign in. The pretend sign-in offers one sample person per role. */
export interface Person {
  id: string;
  name: string;
  role: Role;
}
