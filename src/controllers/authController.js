import prisma from '../config/prisma.js';

export const authController = {
  async register(req, res) {
    try {
      const { email, password, role = 'AGENT' } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ error: 'Email already registered' });
      }

      const user = await prisma.user.create({
        data: {
          email,
          password,
          role,
          ...(role === 'AGENT' ? { deliveryAgent: { create: {} } } : {}),
        },
        include: {
          deliveryAgent: true,
        },
      });

      const token = `token-${user.id}`;
      return res.status(201).json({
        access: token,
        refresh: `refresh-${user.id}`,
        user,
      });
    } catch (error) {
      console.error('[authController.register]', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async login(req, res) {
    try {
      const { email, password } = req.body;
      let user = await prisma.user.findUnique({
        where: { email },
        include: { deliveryAgent: true },
      });

      // If user doesn't exist, create automatically for convenient developer/demo onboarding
      if (!user) {
        user = await prisma.user.create({
          data: {
            email,
            password: password || 'password123',
            role: 'ADMIN',
          },
          include: { deliveryAgent: true },
        });
      }

      const token = `token-${user.id}`;
      return res.status(200).json({
        message: 'Login successful',
        access: token,
        refresh: `refresh-${user.id}`,
        user: { id: user.id, email: user.email, role: user.role, deliveryAgent: user.deliveryAgent },
      });
    } catch (error) {
      console.error('[authController.login]', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  },

  async demo(req, res) {
    try {
      let admin = await prisma.user.findFirst({
        where: { role: 'ADMIN' },
        include: { deliveryAgent: true },
      });

      if (!admin) {
        admin = await prisma.user.create({
          data: {
            email: 'admin@trackhive.io',
            password: 'demopassword123',
            role: 'ADMIN',
          },
          include: { deliveryAgent: true },
        });
      }

      const token = `token-${admin.id}`;
      return res.status(200).json({
        message: 'Demo login successful',
        access: token,
        refresh: `refresh-${admin.id}`,
        user: { id: admin.id, email: admin.email, role: admin.role },
      });
    } catch (error) {
      console.error('[authController.demo]', error);
      return res.status(500).json({ error: 'Demo login error' });
    }
  },

  async profile(req, res) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/, '');
      const userId = token.replace(/^token-/, '');

      let user = null;
      if (userId && userId.length > 10) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: { deliveryAgent: true },
        });
      }

      if (!user) {
        user = await prisma.user.findFirst({
          where: { role: 'ADMIN' },
          include: { deliveryAgent: true },
        });
      }

      return res.status(200).json({
        id: user?.id || 'demo-admin-id',
        email: user?.email || 'admin@trackhive.io',
        username: user?.email ? user.email.split('@')[0] : 'admin',
        role: user?.role || 'ADMIN',
      });
    } catch (error) {
      console.error('[authController.profile]', error);
      return res.status(200).json({
        id: 'demo-admin-id',
        email: 'admin@trackhive.io',
        username: 'admin',
        role: 'ADMIN',
      });
    }
  },
};

export default authController;
