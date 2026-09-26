import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { loginSchema, registerSchema, updateProfileSchema } from '../validators/schemas';

const limit = (max: number, windowMinutes: number, message: string) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message } },
  });

const credentialLimit = limit(20, 15, 'Too many sign-in attempts. Try again in a few minutes');
const refreshLimit = limit(120, 15, 'Too many session refreshes. Try again in a few minutes');

export const authRouter = Router();

authRouter.post('/register', credentialLimit, validate(registerSchema), authController.register);
authRouter.post('/login', credentialLimit, validate(loginSchema), authController.login);
authRouter.post('/refresh', refreshLimit, authController.refresh);
authRouter.post('/logout', refreshLimit, authController.logout);
authRouter.post('/logout-all', authenticate, authController.logoutAll);
authRouter.get('/sessions', authenticate, authController.sessions);
authRouter.delete('/sessions/:sessionId', authenticate, authController.revokeSession);
authRouter.get('/me', authenticate, authController.me);
authRouter.patch('/me', authenticate, validate(updateProfileSchema), authController.updateMe);
