const jwt = require('jsonwebtoken');
const db = require('../config/db');

const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'غير مصرح' });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const [rows] = await db.query('SELECT id, phone, name, role, is_active FROM users WHERE id = ?', [decoded.id]);

        if (!rows.length || !rows[0].is_active) return res.status(401).json({ error: 'حساب غير موجود أو معطل' });

        req.user = rows[0];
        next();
    } catch (err) {
        res.status(401).json({ error: 'توكن غير صالح' });
    }
};

const requireRole = (...roles) => (req, res, next) => {
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'غير مصرح لك' });
    next();
};

module.exports = { auth, requireRole };
