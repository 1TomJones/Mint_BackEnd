declare namespace Express {
  export interface Request {
    requestId?: string;
    adminUserId?: string;
    adminUserEmail?: string;
  }
}
