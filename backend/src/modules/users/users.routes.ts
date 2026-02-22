import { Router } from 'express';
import { UsersController } from './users.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();
const controller = new UsersController();

// Users
router.get('/', authenticate, controller.getUsers);
router.get('/:id', authenticate, controller.getUserById);
router.post('/', authenticate, controller.createUser);
router.put('/:id', authenticate, controller.updateUser);
router.delete('/:id', authenticate, controller.deleteUser);

// Groups
router.get('/groups/list', authenticate, controller.getGroups);
router.get('/groups/:id', authenticate, controller.getGroupById);
router.post('/groups', authenticate, controller.createGroup);
router.put('/groups/:id', authenticate, controller.updateGroup);
router.delete('/groups/:id', authenticate, controller.deleteGroup);

export default router;
