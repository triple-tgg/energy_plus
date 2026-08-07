import { Router } from 'express';
import { AlarmsController } from './alarms.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/accessControl';

const router = Router();
const c = new AlarmsController();

router.get('/configs', authenticate, c.getAlarmConfigs);
router.post('/configs', authenticate, requireRole('admin'), c.createAlarmConfig);
router.post('/configs/import', authenticate, requireRole('admin'), c.importAlarmConfigs);
router.put('/configs/:id', authenticate, requireRole('admin'), c.updateAlarmConfig);
router.delete('/configs/:id', authenticate, requireRole('admin'), c.deleteAlarmConfig);

router.get('/groups', authenticate, c.getAlarmGroups);
router.post('/groups', authenticate, requireRole('admin'), c.createAlarmGroup);
router.put('/groups/:id', authenticate, requireRole('admin'), c.updateAlarmGroup);
router.delete('/groups/:id', authenticate, requireRole('admin'), c.deleteAlarmGroup);
router.post('/groups/:id/test', authenticate, requireRole('admin'), c.testAlarmGroup);
router.post('/groups/:id/test-email', authenticate, requireRole('admin'), c.testAlarmGroupEmail);
router.post('/telegram/chats', authenticate, requireRole('admin'), c.detectTelegramChats);
router.post('/trigger-check', authenticate, requireRole('admin'), c.triggerCheck);
router.get('/recent-alerts', authenticate, c.getRecentAlerts);
router.get('/meter-data/:meterId/recent', authenticate, c.getRecentMeterData);

export default router;
