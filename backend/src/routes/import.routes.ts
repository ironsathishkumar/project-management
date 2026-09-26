import { Router } from 'express';
import multer from 'multer';
import { importController } from '../controllers/import.controller';
import { authenticate } from '../middlewares/authenticate';
import { loadWorkspaceContext, requireWorkspaceAdmin } from '../middlewares/authorize';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

export const importRouter = Router();
importRouter.use(authenticate, loadWorkspaceContext, requireWorkspaceAdmin);
importRouter.post('/document/preview', upload.single('file'), importController.previewDocument);
importRouter.post('/document/apply', upload.single('file'), importController.applyDocument);
