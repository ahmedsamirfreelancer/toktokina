const express = require('express');
const db = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const router = express.Router();

// All routes require admin
router.use(auth, requireRole('admin'));

// ========== DASHBOARD STATS ==========
router.get('/stats', async (req, res) => {
    try {
        const [[users]] = await db.query('SELECT COUNT(*) as total, SUM(role="passenger") as passengers, SUM(role="driver") as drivers FROM users');
        const [[rides]] = await db.query(`SELECT COUNT(*) as total, SUM(status='completed') as completed, SUM(status='cancelled') as cancelled, SUM(status IN ('searching','accepted','arriving','started')) as active FROM rides`);
        const [[revenue]] = await db.query("SELECT COALESCE(SUM(commission_amount), 0) as total_commission, COALESCE(SUM(total_fare), 0) as total_fares FROM rides WHERE status = 'completed'");
        const [[today]] = await db.query("SELECT COUNT(*) as rides, COALESCE(SUM(commission_amount), 0) as commission FROM rides WHERE status = 'completed' AND DATE(completed_at) = CURDATE()");
        const [[onlineDrivers]] = await db.query('SELECT COUNT(*) as count FROM driver_profiles WHERE is_online = 1 AND is_approved = 1');

        res.json({ users, rides, revenue, today, online_drivers: onlineDrivers.count });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== MANAGE DRIVERS ==========
router.get('/drivers', async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        let where = '1=1';
        if (status === 'pending') where = 'dp.is_approved = 0';
        else if (status === 'approved') where = 'dp.is_approved = 1';

        const offset = (page - 1) * limit;
        const [rows] = await db.query(
            `SELECT u.id, u.name, u.phone, u.rating_avg, u.is_active, u.created_at,
             dp.vehicle_type, dp.vehicle_plate, dp.vehicle_color, dp.is_approved, dp.is_online,
             dp.total_rides, dp.total_earnings, dp.wallet_balance
             FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
             WHERE ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
            [parseInt(limit), offset]
        );
        const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM driver_profiles dp WHERE ${where}`);
        res.json({ drivers: rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

router.post('/drivers/:id/approve', async (req, res) => {
    try {
        await db.query('UPDATE driver_profiles SET is_approved = 1 WHERE user_id = ?', [req.params.id]);
        res.json({ message: 'تم تفعيل السائق' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

router.post('/drivers/:id/block', async (req, res) => {
    try {
        await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
        await db.query('UPDATE driver_profiles SET is_online = 0 WHERE user_id = ?', [req.params.id]);
        res.json({ message: 'تم حظر السائق' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== ALL RIDES ==========
router.get('/rides', async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        let where = '1=1';
        if (status) where = `r.status = '${status}'`;

        const offset = (page - 1) * limit;
        const [rows] = await db.query(
            `SELECT r.*, pu.name as passenger_name, du.name as driver_name
             FROM rides r LEFT JOIN users pu ON pu.id = r.passenger_id LEFT JOIN users du ON du.id = r.driver_id
             WHERE ${where} ORDER BY r.requested_at DESC LIMIT ? OFFSET ?`,
            [parseInt(limit), offset]
        );
        const [[{ total }]] = await db.query(`SELECT COUNT(*) as total FROM rides r WHERE ${where}`);
        res.json({ rides: rows, total, page: parseInt(page), pages: Math.ceil(total / limit) });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== PRICING ==========
router.get('/pricing', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM pricing');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

router.put('/pricing/:id', async (req, res) => {
    try {
        const { base_fare, per_km_fare, per_min_fare, min_fare, surge_multiplier } = req.body;
        await db.query(
            'UPDATE pricing SET base_fare = ?, per_km_fare = ?, per_min_fare = ?, min_fare = ?, surge_multiplier = ? WHERE id = ?',
            [base_fare, per_km_fare, per_min_fare, min_fare, surge_multiplier || 1, req.params.id]
        );
        res.json({ message: 'تم تحديث الأسعار' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== REVENUE REPORT ==========
router.get('/revenue', async (req, res) => {
    try {
        const { period = '30' } = req.query;
        const [daily] = await db.query(
            `SELECT DATE(completed_at) as date, COUNT(*) as rides, SUM(total_fare) as fares, SUM(commission_amount) as commission
             FROM rides WHERE status = 'completed' AND completed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
             GROUP BY DATE(completed_at) ORDER BY date DESC`,
            [parseInt(period)]
        );
        res.json(daily);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
