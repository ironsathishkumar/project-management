import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { loginSchema, refreshSchema, registerSchema, updateProfileSchema } from '../validators/schemas';

export const authRouter = Router();

authRouter.post('/register', validate(registerSchema), authController.register);
authRouter.post('/login', validate(loginSchema), authController.login);
authRouter.post('/refresh', validate(refreshSchema), authController.refresh);
authRouter.get('/me', authenticate, authController.me);
authRouter.patch('/me', authenticate, validate(updateProfileSchema), authController.updateMe);
