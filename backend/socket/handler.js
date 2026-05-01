const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { sendPush } = require('../services/push');

function setupSocket(io, app) {
    const userSockets = {}; // userId -> socketId
    app.set('userSockets', userSockets);

    // Auth middleware
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

        socket.join(`${role}_${userId}`);
        console.log(`Socket connected: ${role} #${userId}`);

        // Driver: join online room if already online
        if (role === 'driver') {
            const [dp] = await db.query('SELECT is_online FROM driver_profiles WHERE user_id = ?', [userId]);
            if (dp.length && dp[0].is_online) socket.join('drivers_online');
        }

        // ========== DRIVER LOCATION ==========
        socket.on('driver_location', async (data) => {
            if (role !== 'driver') return;
            const { lat, lng, speed } = data;

            await db.query(
                'UPDATE driver_profiles SET current_lat = ?, current_lng = ?, last_location_update = NOW() WHERE user_id = ?',
                [lat, lng, userId]
            );

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

        // ========== TOGGLE ONLINE ==========
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

        // ========== RIDE CHAT ==========
        socket.on('ride_message', async (data) => {
            const { ride_id, message } = data;
            if (!message?.trim()) return;

            const [ride] = await db.query('SELECT passenger_id, driver_id FROM rides WHERE id = ?', [ride_id]);
            if (!ride.length) return;

            const isPassenger = userId === ride[0].passenger_id;
            const isDriver = userId === ride[0].driver_id;
            if (!isPassenger && !isDriver) return;

            // Save to DB
            await db.query('INSERT INTO ride_messages (ride_id, from_user_id, message) VALUES (?, ?, ?)',
                [ride_id, userId, message.trim()]);

            const toId = isPassenger ? ride[0].driver_id : ride[0].passenger_id;
            const toRole = isPassenger ? 'driver' : 'passenger';

            const msgData = { ride_id, from: userId, message: message.trim(), time: new Date() };

            // Send via socket
            io.to(`${toRole}_${toId}`).emit('ride_message', msgData);

            // Also push notification if user offline
            if (!userSockets[toId]) {
                const [fromUser] = await db.query('SELECT name FROM users WHERE id = ?', [userId]);
                sendPush(toId, fromUser[0]?.name || 'رسالة جديدة', message.trim(), { type: 'chat', ride_id });
            }
        });

        // ========== GET CHAT HISTORY ==========
        socket.on('get_chat_history', async (data) => {
            const { ride_id } = data;
            const [messages] = await db.query(
                'SELECT rm.*, u.name as sender_name FROM ride_messages rm JOIN users u ON u.id = rm.from_user_id WHERE rm.ride_id = ? ORDER BY rm.created_at ASC',
                [ride_id]
            );
            socket.emit('chat_history', { ride_id, messages });
        });

        // ========== DISCONNECT ==========
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
