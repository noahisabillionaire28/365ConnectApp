import { Router, type IRouter } from 'express';
import { attachUserId } from '../middleware/auth.js';
import authRouter        from './auth.js';
import sseRouter         from './sse.js';
import storageRouter     from './storage.js';
import healthRouter      from './health.js';
import adminRouter       from './admin.js';
import usersRouter       from './users.js';
import shiftsRouter      from './shifts.js';
import applicationsRouter from './applications.js';
import conversationsRouter from './conversations.js';
import messagesRouter    from './messages.js';
import notificationsRouter from './notifications.js';
import reviewsRouter     from './reviews.js';
import timeEntriesRouter from './time-entries.js';
import paymentsRouter    from './payments.js';
import postsRouter       from './posts.js';
import followsRouter     from './follows.js';
import shiftRequestsRouter from './shift-requests.js';
import workersRouter     from './workers.js';

const router: IRouter = Router();

// Attach user ID from x-user-id header on every request
router.use(attachUserId);

// SSE stream (must be before body parsers touch the route)
router.use(sseRouter);

// Storage
router.use(storageRouter);

// Auth (public — server-side account creation)
router.use('/auth', authRouter);

// Health + admin
router.use(healthRouter);
router.use('/admin', adminRouter);

// Resource routes
router.use('/users',          usersRouter);
router.use('/shifts',         shiftsRouter);
router.use('/applications',   applicationsRouter);
router.use('/conversations',  conversationsRouter);
router.use('/messages',       messagesRouter);
router.use('/notifications',  notificationsRouter);
router.use('/reviews',        reviewsRouter);
router.use('/time-entries',   timeEntriesRouter);
router.use('/payments',       paymentsRouter);
router.use('/posts',          postsRouter);
router.use('/follows',        followsRouter);
router.use('/shift-requests', shiftRequestsRouter);
router.use('/workers',        workersRouter);

export default router;
