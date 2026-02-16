declare module "jsonwebtoken" {
  export interface JwtPayload {
    [key: string]: unknown;
    sub?: string;
    email?: string;
  }

  export class TokenExpiredError extends Error {
    expiredAt: Date;
  }

  export function verify(token: string, secretOrPublicKey: string): string | JwtPayload;

  const jwt: {
    verify: typeof verify;
  };

  export default jwt;
}
