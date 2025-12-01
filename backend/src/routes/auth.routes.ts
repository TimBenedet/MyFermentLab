import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const sessions = new Map<string, { role: 'admin' | 'viewer'; createdAt: number }>();

// Session cleanup (remove sessions older than 7 days)
setInterval(() => {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [token, session] of sessions.entries()) {
    if (session.createdAt < sevenDaysAgo) {
      sessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // Every hour

// POST /api/auth/login - Admin login
router.post('/login', (req: Request, res: Response) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Generate session token
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { role: 'admin', createdAt: Date.now() });

  res.json({ token, role: 'admin' });
});

// POST /api/auth/viewer - Get viewer session
router.post('/viewer', (req: Request, res: Response) => {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { role: 'viewer', createdAt: Date.now() });

  res.json({ token, role: 'viewer' });
});

// GET /api/auth/verify - Verify token
router.get('/verify', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.json({ role: session.role });
});

// POST /api/auth/logout - Logout
router.post('/logout', (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    sessions.delete(token);
  }

  res.json({ success: true });
});

// Middleware to check authentication
export const requireAuth = (req: Request, res: Response, next: Function) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const session = sessions.get(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  (req as any).user = session;
  next();
};

// Middleware to check admin role
export const requireAdmin = (req: Request, res: Response, next: Function) => {
  const user = (req as any).user;

  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

export default router;
