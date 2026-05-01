const jwt = require('jsonwebtoken');
const db = require('../config/db');

function setupSocket(io, app) {
    const userSockets = {}; // userId -> socketId
    app.set('userSockets', userSockets);

    // Auth middleware for socket
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error('Authentication required'));
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            socket.userRole = decoded.role;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        const userId = socket.userId;
        const role = socket.userRole;
        userSockets[userId] = socket.id;

        // Join role-based room
        socket.join(`${role}_${userId}`);
        console.log(`Socket connected: ${role} #${userId}`);

        // Driver: join online room if already online
        if (role === 'driver') {
            const [dp] = await db.query('SELECT is_online FROM driver_profiles WHERE user_id = ?', [userId]);
            if (dp.length && dp[0].is_online) {
                socket.join('drivers_online');
            }
        }

        // Driver: real-time location updates
        socket.on('driver_location', async (data) => {
            if (role !== 'driver') return;
            const { lat, lng, speed } = data;

            await db.query(
                'UPDATE driver_profiles SET current_lat = ?, current_lng = ?, last_location_update = NOW() WHERE user_id = ?',
                [lat, lng, userId]
            );

            // If has active ride, broadcast to passenger
            const [ride] = await db.query(
                "SELECT id, passenger_id FROM rides WHERE driver_id = ? AND status IN ('accepted', 'arriving', 'started')",
                [userId]
            );
            if (ride.length) {
                io.to(`passenger_${ride[0].passenger_id}`).emit('driver_location', {
                    ride_id: ride[0].id, lat, lng, speed
                });
            }
        });

        // Driver: go online/offline
        socket.on('toggle_online', async (data) => {
            if (role !== 'driver') return;
            const { is_online, lat, lng } = data;

            await db.query(
                'UPDATE driver_profiles SET is_online = ?, current_lat = COALESCE(?, current_lat), current_lng = COALESCE(?, current_lng) WHERE user_id = ?',
                [is_online ? 1 : 0, lat, lng, userId]
            );

            if (is_online) socket.join('drivers_online');
            else socket.leave('drivers_online');

            socket.emit('online_status', { is_online });
        });

        // Chat message during ride
        socket.on('ride_message', async (data) => {
            const { ride_id, message } = data;
            const [ride] = await db.query('SELECT passenger_id, driver_id FROM rides WHERE id = ?', [ride_id]);
            if (!ride.length) return;

            const toId = userId === ride[0].passenger_id ? ride[0].driver_id : ride[0].passenger_id;
            const toRole = userId === ride[0].passenger_id ? 'driver' : 'passenger';
            io.to(`${toRole}_${toId}`).emit('ride_message', { ride_id, from: userId, message, time: new Date() });
        });

        socket.on('disconnect', () => {
            delete userSockets[userId];
            if (role === 'driver') {
                db.query('UPDATE driver_profiles SET is_online = 0 WHERE user_id = ?', [userId]);
            }
            console.log(`Socket disconnected: ${role} #${userId}`);
        });
    });
}

module.exports = setupSocket;
