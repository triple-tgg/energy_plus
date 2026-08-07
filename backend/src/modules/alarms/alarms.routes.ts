import { Router } from 'express';
import { AlarmsController } from './alarms.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const c = new AlarmsController();

router.get('/configs', authenticate, c.getAlarmConfigs);
router.post('/configs', authenticate, c.createAlarmConfig);
router.post('/configs/import', authenticate, c.importAlarmConfigs);
router.put('/configs/:id', authenticate, c.updateAlarmConfig);
router.delete('/configs/:id', authenticate, c.deleteAlarmConfig);

router.get('/groups', authenticate, c.getAlarmGroups);
router.post('/groups', authenticate, c.createAlarmGroup);
router.put('/groups/:id', authenticate, c.updateAlarmGroup);
router.delete('/groups/:id', authenticate, c.deleteAlarmGroup);
router.post('/groups/:id/test', authenticate, c.testAlarmGroup);
router.post('/groups/:id/test-email', authenticate, c.testAlarmGroupEmail);
router.post('/telegram/chats', authenticate, c.detectTelegramChats);
router.post('/trigger-check', authenticate, c.triggerCheck);
router.get('/recent-alerts', authenticate, c.getRecentAlerts);
router.get('/meter-data/:meterId/recent', authenticate, c.getRecentMeterData);

export default router;
