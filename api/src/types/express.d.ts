import type { AuthUser } from "../modules/auth/auth.schemas.js";

// Declaration merging: Express.Request gana `user` tras `authenticate`.
declare global {
  namespace Express {
    interface Request {
      /** Usuario autenticado; lo setea el middleware `authenticate`. */
      user?: AuthUser;
    }
  }
}

export {};
