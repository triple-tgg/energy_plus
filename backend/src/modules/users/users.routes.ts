import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/accessControl';

const router = Router();
const controller = new UsersController();
router.use(authenticate, requireRole('admin'));

// Groups
router.get('/groups/list', controller.getGroups);
router.get('/groups/:id', controller.getGroupById);
router.post('/groups', controller.createGroup);
router.put('/groups/:id', controller.updateGroup);
router.delete('/groups/:id', controller.deleteGroup);
router.get('/groups/:id/permissions', controller.getGroupPermissions);
router.put('/groups/:id/permissions', controller.updateGroupPermissions);

// Users (parameterized routes must follow /groups routes)
router.get('/', controller.getUsers);
router.post('/', controller.createUser);
router.get('/:id', controller.getUserById);
router.put('/:id', controller.updateUser);
router.delete('/:id', controller.deleteUser);
router.post('/:id/reset-password', controller.resetPassword);

export default router;
