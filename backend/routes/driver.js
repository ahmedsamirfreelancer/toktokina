const express = require('express');
const db = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const router = express.Router();

// ========== GO ONLINE / OFFLINE ==========
router.post('/toggle-online', auth, requireRole('driver'), async (req, res) => {
    try {
        const { is_online, lat, lng } = req.body;
        await db.query(
            'UPDATE driver_profiles SET is_online = ?, current_lat = COALESCE(?, current_lat), current_lng = COALESCE(?, current_lng), last_location_update = NOW() WHERE user_id = ?',
            [is_online ? 1 : 0, lat, lng, req.user.id]
        );

        const io = req.app.get('io');
        if (io) {
            const socketId = req.app.get('userSockets')?.[req.user.id];
            if (socketId) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    if (is_online) socket.join('drivers_online');
                    else socket.leave('drivers_online');
                }
            }
        }

        res.json({ message: is_online ? 'أنت أونلاين دلوقتي' : 'أنت أوفلاين', is_online });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== UPDATE LOCATION ==========
router.post('/update-location', auth, requireRole('driver'), async (req, res) => {
    try {
        const { lat, lng, speed } = req.body;
        await db.query(
            'UPDATE driver_profiles SET current_lat = ?, current_lng = ?, last_location_update = NOW() WHERE user_id = ?',
            [lat, lng, req.user.id]
        );

        // If driver has active ride, track it
        const [ride] = await db.query(
            "SELECT id, passenger_id FROM rides WHERE driver_id = ? AND status IN ('accepted', 'arriving', 'started')",
            [req.user.id]
        );
        if (ride.length) {
            await db.query('INSERT INTO ride_tracking (ride_id, lat, lng, speed) VALUES (?, ?, ?, ?)',
                [ride[0].id, lat, lng, speed || null]);

            const io = req.app.get('io');
            if (io) {
                io.to(`passenger_${ride[0].passenger_id}`).emit('driver_location', { ride_id: ride[0].id, lat, lng, speed });
            }
        }

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== GET EARNINGS ==========
router.get('/earnings', auth, requireRole('driver'), async (req, res) => {
    try {
        const { period = 'today' } = req.query;
        let dateFilter;
        switch (period) {
            case 'today': dateFilter = 'DATE(r.completed_at) = CURDATE()'; break;
            case 'week': dateFilter = 'r.completed_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)'; break;
            case 'month': dateFilter = 'r.completed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)'; break;
            default: dateFilter = 'DATE(r.completed_at) = CURDATE()';
        }

        const [stats] = await db.query(
            `SELECT COUNT(*) as total_rides, COALESCE(SUM(r.driver_earnings), 0) as total_earnings,
             COALESCE(SUM(r.total_fare), 0) as total_fares, COALESCE(SUM(r.commission_amount), 0) as total_commission,
             COALESCE(AVG(r.distance_km), 0) as avg_distance
             FROM rides r WHERE r.driver_id = ? AND r.status = 'completed' AND ${dateFilter}`,
            [req.user.id]
        );

        const [profile] = await db.query('SELECT wallet_balance, total_rides, total_earnings FROM driver_profiles WHERE user_id = ?', [req.user.id]);

        res.json({ period, stats: stats[0], wallet: profile[0] });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== GET TRANSACTIONS ==========
router.get('/transactions', auth, requireRole('driver'), async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
