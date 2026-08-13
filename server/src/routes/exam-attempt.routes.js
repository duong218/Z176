import express from 'express';
import { examAttemptController } from '../controllers/exam-attempt.controller.js';
import { authenticate, requireRoleCodes } from '../middlewares/auth.middleware.js';
import { requirePasswordChanged } from '../middlewares/require-password-changed.middleware.js';

const router = express.Router();

router.use(authenticate);
router.use(requirePasswordChanged);
router.use(requireRoleCodes('candidate'));

router.get('/my-exam', examAttemptController.getMyExam);
router.post('/start', examAttemptController.start);
router.post('/:id/submit', examAttemptController.submit);
router.patch('/:id/answer', examAttemptController.answer);
router.post('/:id/heartbeat', examAttemptController.heartbeat);

export default router;