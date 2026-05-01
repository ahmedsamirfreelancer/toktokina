const express = require('express');
const db = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const { calculateFare, generateRideCode, findNearbyDrivers, calculateSurge } = require('../services/pricing');
const router = express.Router();

// ========== REQUEST RIDE ==========
router.post('/request', auth, requireRole('passenger'), async (req, res) => {
    try {
        const { pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address, payment_method, vehicle_type } = req.body;

        if (!pickup_lat || !pickup_lng || !dropoff_lat || !dropoff_lng) {
            return res.status(400).json({ error: 'نقطة الركوب والنزول مطلوبين' });
        }

        // Check no active ride
        const [active] = await db.query(
            "SELECT id FROM rides WHERE passenger_id = ? AND status IN ('searching', 'accepted', 'arriving', 'started')",
            [req.user.id]
        );
        if (active.length) return res.status(400).json({ error: 'عندك رحلة شغالة بالفعل' });

        // Calculate fare
        const fare = await calculateFare(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type || 'toktok');
        const rideCode = generateRideCode();

        const [result] = await db.query(
            `INSERT INTO rides (ride_code, passenger_id, pickup_lat, pickup_lng, pickup_address, dropoff_lat, dropoff_lng, dropoff_address,
             distance_km, base_fare, distance_fare, total_fare, commission_rate, payment_method)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [rideCode, req.user.id, pickup_lat, pickup_lng, pickup_address || '', dropoff_lat, dropoff_lng, dropoff_address || '',
             fare.distance_km, fare.base_fare, fare.distance_fare, fare.total_fare, parseFloat(process.env.COMMISSION_RATE) || 12, payment_method || 'cash']
        );

        const ride = {
            id: result.insertId,
            ride_code: rideCode,
            ...fare,
            payment_method: payment_method || 'cash',
            status: 'searching'
        };

        // Find nearby drivers and notify only them
        const nearbyDrivers = await findNearbyDrivers(pickup_lat, pickup_lng, 5, vehicle_type || null);
        const io = req.app.get('io');
        const userSockets = req.app.get('userSockets') || {};
        if (io && nearbyDrivers.length) {
            const rideData = {
                ride_id: result.insertId,
                ride_code: rideCode,
                pickup: { lat: pickup_lat, lng: pickup_lng, address: pickup_address },
                dropoff: { lat: dropoff_lat, lng: dropoff_lng, address: dropoff_address },
                fare: fare.total_fare,
                distance_km: fare.distance_km,
                payment_method: payment_method || 'cash'
            };
            for (const driver of nearbyDrivers) {
                const socketId = userSockets[driver.user_id];
                if (socketId) {
                    io.to(socketId).emit('new_ride_request', { ...rideData, distance_to_pickup: driver.distance_km });
                }
            }
        }

        // Auto-cancel after 2 minutes if no driver accepts
        setTimeout(async () => {
            const [check] = await db.query('SELECT status FROM rides WHERE id = ?', [result.insertId]);
            if (check.length && check[0].status === 'searching') {
                await db.query("UPDATE rides SET status = 'cancelled', cancelled_by = 'system', cancel_reason = 'لم يتم العثور على سائق', cancelled_at = NOW() WHERE id = ?", [result.insertId]);
                if (io) io.to(`passenger_${req.user.id}`).emit('ride_cancelled', { ride_id: result.insertId, reason: 'لم يتم العثور على سائق' });
            }
        }, 120000);

        res.status(201).json(ride);
    } catch (err) {
        console.error('Request ride error:', err);
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== ESTIMATE FARE ==========
router.post('/estimate', auth, async (req, res) => {
    try {
        const { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type } = req.body;
        const fare = await calculateFare(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicle_type || 'toktok');
        res.json(fare);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== ACCEPT RIDE (Driver) ==========
router.post('/:id/accept', auth, requireRole('driver'), async (req, res) => {
    try {
        const rideId = req.params.id;

        // Check driver is approved
        const [dp] = await db.query('SELECT * FROM driver_profiles WHERE user_id = ? AND is_approved = 1', [req.user.id]);
        if (!dp.length) return res.status(403).json({ error: 'حسابك لسه ما اتفعلش' });

        // Atomic accept - only if still searching
        const [result] = await db.query(
            "UPDATE rides SET driver_id = ?, status = 'accepted', accepted_at = NOW() WHERE id = ? AND status = 'searching'",
            [req.user.id, rideId]
        );
        if (!result.affectedRows) return res.status(409).json({ error: 'الرحلة دي اتاخدت أو اتلغت' });

        const [ride] = await db.query('SELECT * FROM rides WHERE id = ?', [rideId]);
        const [driver] = await db.query(
            `SELECT u.name, u.phone, u.rating_avg, dp.vehicle_type, dp.vehicle_plate, dp.vehicle_color, dp.current_lat, dp.current_lng
             FROM users u JOIN driver_profiles dp ON dp.user_id = u.id WHERE u.id = ?`, [req.user.id]
        );

        const io = req.app.get('io');
        if (io) {
            // Notify passenger
            io.to(`passenger_${ride[0].passenger_id}`).emit('ride_accepted', {
                ride_id: rideId,
                driver: driver[0]
            });
            // Remove from available rides
            io.to('drivers_online').emit('ride_taken', { ride_id: rideId });
        }

        res.json({ message: 'تم قبول الرحلة', ride: ride[0] });
    } catch (err) {
        console.error('Accept ride error:', err);
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== UPDATE RIDE STATUS (Driver) ==========
router.post('/:id/status', auth, requireRole('driver'), async (req, res) => {
    try {
        const { status } = req.body;
        const rideId = req.params.id;
        const validTransitions = {
            'accepted': ['arriving'],
            'arriving': ['started'],
            'started': ['completed']
        };

        const [ride] = await db.query('SELECT * FROM rides WHERE id = ? AND driver_id = ?', [rideId, req.user.id]);
        if (!ride.length) return res.status(404).json({ error: 'الرحلة مش موجودة' });

        const allowed = validTransitions[ride[0].status];
        if (!allowed || !allowed.includes(status)) return res.status(400).json({ error: 'لا يمكن التغيير لهذه الحالة' });

        const timeField = { arriving: 'arrived_at', started: 'started_at', completed: 'completed_at' }[status];
        await db.query(`UPDATE rides SET status = ?, ${timeField} = NOW() WHERE id = ?`, [status, rideId]);

        // If completed, calculate earnings
        if (status === 'completed') {
            const commission = ride[0].total_fare * (ride[0].commission_rate / 100);
            const driverEarnings = ride[0].total_fare - commission;

            await db.query('UPDATE rides SET commission_amount = ?, driver_earnings = ?, payment_status = ? WHERE id = ?',
                [commission, driverEarnings, 'paid', rideId]);

            // Update driver stats
            await db.query(
                'UPDATE driver_profiles SET total_rides = total_rides + 1, total_earnings = total_earnings + ?, wallet_balance = wallet_balance + ? WHERE user_id = ?',
                [driverEarnings, ride[0].payment_method === 'cash' ? -commission : driverEarnings, req.user.id]
            );

            // Record transactions
            await db.query(
                'INSERT INTO transactions (user_id, ride_id, type, amount, balance_after, payment_method) VALUES (?, ?, ?, ?, (SELECT wallet_balance FROM driver_profiles WHERE user_id = ?), ?)',
                [req.user.id, rideId, 'ride_payment', driverEarnings, req.user.id, ride[0].payment_method]
            );
        }

        const io = req.app.get('io');
        if (io) {
            io.to(`passenger_${ride[0].passenger_id}`).emit('ride_status_update', { ride_id: rideId, status });
        }

        res.json({ message: 'تم التحديث', status });
    } catch (err) {
        console.error('Update status error:', err);
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== CANCEL RIDE ==========
router.post('/:id/cancel', auth, async (req, res) => {
    try {
        const { reason } = req.body;
        const rideId = req.params.id;
        const cancelledBy = req.user.role === 'driver' ? 'driver' : 'passenger';

        const [ride] = await db.query('SELECT * FROM rides WHERE id = ? AND (passenger_id = ? OR driver_id = ?)',
            [rideId, req.user.id, req.user.id]);
        if (!ride.length) return res.status(404).json({ error: 'الرحلة مش موجودة' });
        if (['completed', 'cancelled'].includes(ride[0].status)) return res.status(400).json({ error: 'الرحلة خلصت أو اتلغت' });

        await db.query("UPDATE rides SET status = 'cancelled', cancelled_by = ?, cancel_reason = ?, cancelled_at = NOW() WHERE id = ?",
            [cancelledBy, reason || '', rideId]);

        const io = req.app.get('io');
        if (io) {
            const notifyId = cancelledBy === 'driver' ? ride[0].passenger_id : ride[0].driver_id;
            if (notifyId) io.to(`${cancelledBy === 'driver' ? 'passenger' : 'driver'}_${notifyId}`).emit('ride_cancelled', { ride_id: rideId, cancelled_by: cancelledBy, reason });
        }

        res.json({ message: 'تم إلغاء الرحلة' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== RATE RIDE ==========
router.post('/:id/rate', auth, async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const rideId = req.params.id;

        if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'التقييم لازم يكون من 1 لـ 5' });

        const [ride] = await db.query("SELECT * FROM rides WHERE id = ? AND status = 'completed'", [rideId]);
        if (!ride.length) return res.status(404).json({ error: 'الرحلة مش موجودة أو لسه ما خلصتش' });

        const toUserId = req.user.role === 'driver' ? ride[0].passenger_id : ride[0].driver_id;

        await db.query('INSERT INTO ratings (ride_id, from_user_id, to_user_id, rating, comment) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE rating = ?, comment = ?',
            [rideId, req.user.id, toUserId, rating, comment || null, rating, comment || null]);

        // Update average rating
        const [avg] = await db.query('SELECT AVG(rating) as avg_rating, COUNT(*) as cnt FROM ratings WHERE to_user_id = ?', [toUserId]);
        await db.query('UPDATE users SET rating_avg = ?, rating_count = ? WHERE id = ?',
            [avg[0].avg_rating, avg[0].cnt, toUserId]);

        res.json({ message: 'شكراً على التقييم' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'أنت قيمت الرحلة دي قبل كده' });
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== GET MY RIDES ==========
router.get('/my-rides', auth, async (req, res) => {
    try {
        const field = req.user.role === 'driver' ? 'driver_id' : 'passenger_id';
        const [rides] = await db.query(
            `SELECT r.*, u.name as other_name, u.phone as other_phone, u.rating_avg as other_rating
             FROM rides r LEFT JOIN users u ON u.id = ${req.user.role === 'driver' ? 'r.passenger_id' : 'r.driver_id'}
             WHERE r.${field} = ? ORDER BY r.requested_at DESC LIMIT 50`,
            [req.user.id]
        );
        res.json(rides);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== GET ACTIVE RIDE ==========
router.get('/active', auth, async (req, res) => {
    try {
        const field = req.user.role === 'driver' ? 'driver_id' : 'passenger_id';
        const [rides] = await db.query(
            `SELECT r.*,
             pu.name as passenger_name, pu.phone as passenger_phone, pu.rating_avg as passenger_rating,
             du.name as driver_name, du.phone as driver_phone, du.rating_avg as driver_rating,
             dp.vehicle_type, dp.vehicle_plate, dp.vehicle_color, dp.current_lat as driver_lat, dp.current_lng as driver_lng
             FROM rides r
             LEFT JOIN users pu ON pu.id = r.passenger_id
             LEFT JOIN users du ON du.id = r.driver_id
             LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id
             WHERE r.${field} = ? AND r.status IN ('searching', 'accepted', 'arriving', 'started')
             LIMIT 1`,
            [req.user.id]
        );
        res.json(rides[0] || null);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
