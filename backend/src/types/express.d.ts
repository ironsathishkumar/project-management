import { AuthUser, WorkspaceContext } from '../types';

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      workspaceContext?: WorkspaceContext;
    }
  }
}

export {};
