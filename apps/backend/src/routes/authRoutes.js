import { Router } from 'express';
import { authController } from '../controllers/authController.js';

const router = Router();

// Registration
router.post('/register', authController.register);
router.post('/register/', authController.register);

// Login
router.post('/login', authController.login);
router.post('/login/', authController.login);

// Token Refresh
router.post('/refresh', authController.refresh);
router.post('/refresh/', authController.refresh);

// Demo Login
router.post('/demo', authController.demo);
router.post('/demo/', authController.demo);

// Profile
router.get('/profile', authController.profile);
router.get('/profile/', authController.profile);

export default router;
