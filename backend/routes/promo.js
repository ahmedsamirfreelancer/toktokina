const express = require('express');
const db = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const router = express.Router();

// ========== APPLY PROMO CODE ==========
router.post('/apply', auth, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'الكود مطلوب' });

        const [rows] = await db.query(
            "SELECT * FROM promo_codes WHERE code = ? AND is_active = 1 AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)",
            [code.toUpperCase()]
        );
        if (!rows.length) return res.status(404).json({ error: 'الكود مش صالح أو منتهي' });

        const promo = rows[0];

        // Check if user already used this code
        const [used] = await db.query('SELECT id FROM promo_usage WHERE promo_id = ? AND user_id = ?', [promo.id, req.user.id]);
        if (used.length) return res.status(400).json({ error: 'أنت استخدمت الكود ده قبل كده' });

        res.json({
            discount_type: promo.discount_type,
            discount_value: promo.discount_value,
            max_discount: promo.max_discount,
            message: `خصم ${promo.discount_type === 'percentage' ? promo.discount_value + '%' : promo.discount_value + ' جنيه'}`
        });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== GET REFERRAL CODE ==========
router.get('/my-referral', auth, async (req, res) => {
    try {
        let [rows] = await db.query('SELECT referral_code FROM users WHERE id = ?', [req.user.id]);
        let code = rows[0]?.referral_code;
        if (!code) {
            code = 'TK' + req.user.id.toString(36).toUpperCase() + Math.random().toString(36).substr(2, 3).toUpperCase();
            await db.query('UPDATE users SET referral_code = ? WHERE id = ?', [code, req.user.id]);
        }
        const [[{ count }]] = await db.query('SELECT COUNT(*) as count FROM users WHERE referred_by = ?', [req.user.id]);
        res.json({ code, referral_count: count });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== ADMIN: MANAGE PROMOS ==========
router.get('/admin/list', auth, requireRole('admin'), async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM promo_codes ORDER BY created_at DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

router.post('/admin/create', auth, requireRole('admin'), async (req, res) => {
    try {
        const { code, discount_type, discount_value, max_discount, max_uses, expires_at } = req.body;
        await db.query(
            'INSERT INTO promo_codes (code, discount_type, discount_value, max_discount, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
            [code.toUpperCase(), discount_type || 'percentage', discount_value, max_discount || null, max_uses || null, expires_at || null]
        );
        res.status(201).json({ message: 'تم إنشاء الكود' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'الكود موجود بالفعل' });
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
