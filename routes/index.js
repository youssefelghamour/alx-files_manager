import express from 'express';
import AppController from '../controllers/AppController';
import UsersController from '../controllers/UsersController';
import AuthController from '../controllers/AuthController';

const router = express.Router();

// Status route
router.get('/status', AppController.getStatus);
// Stats route
router.get('/stats', AppController.getStats);

// Create a new user
router.post('/users', UsersController.postNew);

// Authentication routes
router.get('/connect', AuthController.getConnect);
router.get('/disconnect', AuthController.getDisconnect);

// User route: retrieves the logged in user
router.get('/users/me', UsersController.getMe);

export default router;
