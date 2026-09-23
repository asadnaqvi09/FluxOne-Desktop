import { Router } from 'express';
import { connectDb } from '../config/database.js';
import { success, error } from '../shared/utils/response.js';
import { isRequestOnline } from '../shared/middlewares/online.middleware.js';
import authRoutes from './auth.routes.js';
import syncRoutes from './sync.routes.js';
import setupRoutes from './setup.routes.js';
import cashDrawerRoutes from './cashDrawer.routes.js';
import catalogRoutes from './catalog.routes.js';
import saleRoutes from './sale.routes.js';
import invoiceRoutes from './invoice.routes.js';
import notificationRoutes from './notification.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

router.get('/health', (_req, res) => {
  try {
    connectDb().prepare('SELECT 1 AS ok').get();
    return success(res, { status: 'ok' });
  } catch (err) {
    return error(res, err.message || 'Database unavailable', 500);
  }
});
router.get('/network', (req, res) => {
  return success(res, { online: isRequestOnline(req) });
});
router.use('/auth', authRoutes);
router.use('/setup', setupRoutes);
router.use('/sync', syncRoutes);
router.use('/cash-drawer', cashDrawerRoutes);
router.use(catalogRoutes);
router.use('/sales', saleRoutes);
router.use('/invoices', invoiceRoutes);
router.use('/notifications', notificationRoutes);
router.use('/admin', adminRoutes);

export default router;