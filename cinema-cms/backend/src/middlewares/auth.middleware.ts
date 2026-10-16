import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER';
  cinemaId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Vui lòng đăng nhập để tiếp tục.' }
    });
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) throw new Error('Missing JWT_ACCESS_SECRET environment variable');
    const decoded = jwt.verify(token, secret) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED_OR_INVALID', message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' }
    });
  }
};

export const requireRoles = (...allowedRoles: Array<'ADMIN' | 'MANAGER' | 'STAFF' | 'CUSTOMER'>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Chưa xác thực người dùng.' }
      });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN_INSUFFICIENT_ROLE',
          message: `Vai trò ${req.user.role} không có quyền thực hiện thao tác này.`
        }
      });
    }
    next();
  };
};

export const enforceCinemaScope = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ success: false });
  if (req.user.role === 'ADMIN') return next();

  const targetCinemaId = req.body.cinemaId || req.query.cinemaId || req.params.cinemaId;
  if (targetCinemaId && req.user.cinemaId && targetCinemaId !== req.user.cinemaId) {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN_CINEMA_SCOPE',
        message: 'Bạn chỉ được phép thao tác trên dữ liệu thuộc cụm rạp được phân công.'
      }
    });
  }
  next();
};
