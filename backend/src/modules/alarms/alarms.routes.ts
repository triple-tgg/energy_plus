import { Router } from 'express';
import { AlarmsController } from './alarms.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const c = new AlarmsController();

router.get('/configs', authenticate, c.getAlarmConfigs);
router.post('/configs', authenticate, c.createAlarmConfig);
router.put('/configs/:id', authenticate, c.updateAlarmConfig);
router.delete('/configs/:id', authenticate, c.deleteAlarmConfig);

router.get('/groups', authenticate, c.getAlarmGroups);
router.post('/groups', authenticate, c.createAlarmGroup);
router.put('/groups/:id', authenticate, c.updateAlarmGroup);
router.delete('/groups/:id', authenticate, c.deleteAlarmGroup);

export default router;
