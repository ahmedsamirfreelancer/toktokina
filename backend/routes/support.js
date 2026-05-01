const express = require('express');
const db = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const router = express.Router();

// ========== CREATE TICKET ==========
router.post('/', auth, async (req, res) => {
    try {
        const { subject, message, ride_id } = req.body;
        if (!subject || !message) return res.status(400).json({ error: 'الموضوع والرسالة مطلوبين' });

        const [result] = await db.query(
            'INSERT INTO support_tickets (user_id, ride_id, subject, message) VALUES (?, ?, ?, ?)',
            [req.user.id, ride_id || null, subject, message]
        );
        res.status(201).json({ id: result.insertId, message: 'تم إرسال الشكوى، هنرد عليك في أقرب وقت' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== MY TICKETS ==========
router.get('/my-tickets', auth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT * FROM support_tickets WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== ADMIN: ALL TICKETS ==========
router.get('/admin/all', auth, requireRole('admin'), async (req, res) => {
    try {
        const { status } = req.query;
        let where = '1=1';
        if (status) where = `t.status = '${status}'`;

        const [rows] = await db.query(
            `SELECT t.*, u.name, u.phone FROM support_tickets t JOIN users u ON u.id = t.user_id WHERE ${where} ORDER BY t.created_at DESC`
        );
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== ADMIN: REPLY ==========
router.post('/admin/:id/reply', auth, requireRole('admin'), async (req, res) => {
    try {
        const { reply } = req.body;
        await db.query("UPDATE support_tickets SET admin_reply = ?, status = 'resolved', resolved_at = NOW() WHERE id = ?",
            [reply, req.params.id]);
        res.json({ message: 'تم الرد' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
