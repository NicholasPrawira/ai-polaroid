/** The only account that can see /admin. Mirrored by the `private.is_admin()`
 *  Postgres function, which is what actually gates the `profiles` RLS
 *  policies — this constant is a UI/routing convenience, not the security
 *  boundary. */
export const ADMIN_EMAIL = "nicholasprawiratan@gmail.com";
