const express = require('express');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get favorites
router.get('/', auth, async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM favorite_places WHERE user_id = ? ORDER BY name', [req.user.id]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// Add favorite
router.post('/', auth, async (req, res) => {
    try {
        const { name, lat, lng, address } = req.body;
        if (!name || !lat || !lng) return res.status(400).json({ error: 'الاسم والموقع مطلوبين' });

        const [result] = await db.query(
            'INSERT INTO favorite_places (user_id, name, lat, lng, address) VALUES (?, ?, ?, ?, ?)',
            [req.user.id, name, lat, lng, address || '']
        );
        res.status(201).json({ id: result.insertId });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// Delete favorite
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query('DELETE FROM favorite_places WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'تم الحذف' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
