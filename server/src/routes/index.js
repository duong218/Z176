import { Router } from 'express';
import authRoutes from './auth.routes.js';
import topicRoutes from './topic.routes.js';
import departmentRoutes from './department.routes.js';
import questionRoutes from './question.routes.js';
import userRoutes from './user.routes.js';
import roleRoutes from './role.routes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/topics', topicRoutes);
router.use('/departments', departmentRoutes);
router.use('/questions', questionRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);

export default router;
