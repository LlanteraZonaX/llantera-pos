import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'llantera_secret_dev_2024';

export const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer '))
    return res.status(401).json({ error: 'Token requerido' });

  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const authorize = (...roles) => (req, res, next) => {
  if (req.user?.permisos?.todo) return next();
  if (!roles.includes(req.user?.rol))
    return res.status(403).json({ error: 'Sin permisos para esta acción' });
  next();
};
