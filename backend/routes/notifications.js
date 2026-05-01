const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const { saveSubscription, VAPID_PUBLIC } = require('../services/push');
const router = express.Router();

// Get VAPID public key
router.get('/vapid-key', (req, res) => {
    res.json({ key: VAPID_PUBLIC });
});

// Subscribe to push
router.post('/subscribe', auth, async (req, res) => {
    try {
        const { subscription } = req.body;
        if (!subscription?.endpoint) return res.status(400).json({ error: 'بيانات الاشتراك ناقصة' });
        await saveSubscription(req.user.id, subscription);
        res.json({ message: 'تم الاشتراك في الإشعارات' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// Get notifications
router.get('/', auth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// Mark as read
router.post('/read', auth, async (req, res) => {
    try {
        await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'تم' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// Unread count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
