const webpush = require('web-push');
const db = require('../config/db');

// Generate VAPID keys once: npx web-push generate-vapid-keys
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
    webpush.setVapidDetails('mailto:admin@toktokina.com', VAPID_PUBLIC, VAPID_PRIVATE);
}

// Save push subscription
async function saveSubscription(userId, subscription) {
    await db.query(
        'INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE p256dh = ?, auth_key = ?',
        [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, subscription.keys.p256dh, subscription.keys.auth]
    );
}

// Send push to user
async function sendPush(userId, title, body, data = {}) {
    if (!VAPID_PUBLIC) return;
    try {
        const [subs] = await db.query('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId]);
        for (const sub of subs) {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: { p256dh: sub.p256dh, auth: sub.auth_key }
            };
            try {
                await webpush.sendNotification(pushSub, JSON.stringify({ title, body, data }));
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                }
            }
        }
    } catch (err) {
        console.error('Push error:', err.message);
    }
}

// Send to multiple users
async function sendPushToMany(userIds, title, body, data = {}) {
    await Promise.allSettled(userIds.map(id => sendPush(id, title, body, data)));
}

module.exports = { saveSubscription, sendPush, sendPushToMany, VAPID_PUBLIC };
