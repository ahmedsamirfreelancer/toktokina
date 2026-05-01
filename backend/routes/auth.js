const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Generate OTP
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate JWT
function generateToken(user) {
    return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '30d' });
}

// ========== REGISTER ==========
router.post('/register', async (req, res) => {
    try {
        const { phone, name, password, role = 'passenger' } = req.body;
        if (!phone || !name || !password) return res.status(400).json({ error: 'الاسم والتليفون والباسورد مطلوبين' });
        if (!['passenger', 'driver'].includes(role)) return res.status(400).json({ error: 'نوع الحساب غلط' });

        const [existing] = await db.query('SELECT id FROM users WHERE phone = ?', [phone]);
        if (existing.length) return res.status(409).json({ error: 'الرقم ده مسجل قبل كده' });

        const password_hash = await bcrypt.hash(password, 10);
        const otp = generateOTP();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        const [result] = await db.query(
            'INSERT INTO users (phone, name, password_hash, role, otp_code, otp_expires) VALUES (?, ?, ?, ?, ?, ?)',
            [phone, name, password_hash, role, otp, otpExpires]
        );

        // If driver, create profile
        if (role === 'driver') {
            const { vehicle_plate, vehicle_color, vehicle_type } = req.body;
            await db.query(
                'INSERT INTO driver_profiles (user_id, vehicle_plate, vehicle_color, vehicle_type) VALUES (?, ?, ?, ?)',
                [result.insertId, vehicle_plate || '', vehicle_color || '', vehicle_type || 'toktok']
            );
        }

        // TODO: Send OTP via SMS (Vodafone SMS API)
        console.log(`OTP for ${phone}: ${otp}`);

        const token = generateToken({ id: result.insertId, role });
        res.status(201).json({ token, user: { id: result.insertId, phone, name, role }, otp_sent: true });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'حصل مشكلة، حاول تاني' });
    }
});

// ========== LOGIN ==========
router.post('/login', async (req, res) => {
    try {
        const { phone, password } = req.body;
        if (!phone || !password) return res.status(400).json({ error: 'التليفون والباسورد مطلوبين' });

        const [rows] = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
        if (!rows.length) return res.status(401).json({ error: 'رقم التليفون أو الباسورد غلط' });

        const user = rows[0];
        if (!user.is_active) return res.status(403).json({ error: 'الحساب ده معطل' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'رقم التليفون أو الباسورد غلط' });

        // Get driver profile if driver
        let driverProfile = null;
        if (user.role === 'driver') {
            const [dp] = await db.query('SELECT * FROM driver_profiles WHERE user_id = ?', [user.id]);
            driverProfile = dp[0] || null;
        }

        const token = generateToken(user);
        res.json({
            token,
            user: { id: user.id, phone: user.phone, name: user.name, role: user.role, avatar: user.avatar, rating_avg: user.rating_avg },
            driverProfile
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'حصل مشكلة، حاول تاني' });
    }
});

// ========== VERIFY OTP ==========
router.post('/verify-otp', auth, async (req, res) => {
    try {
        const { otp } = req.body;
        const [rows] = await db.query('SELECT otp_code, otp_expires FROM users WHERE id = ?', [req.user.id]);
        const user = rows[0];

        if (!user || user.otp_code !== otp) return res.status(400).json({ error: 'كود التحقق غلط' });
        if (new Date() > new Date(user.otp_expires)) return res.status(400).json({ error: 'كود التحقق انتهى، اطلب واحد جديد' });

        await db.query('UPDATE users SET is_verified = 1, otp_code = NULL, otp_expires = NULL WHERE id = ?', [req.user.id]);
        res.json({ message: 'تم التحقق بنجاح' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== GET PROFILE ==========
router.get('/profile', auth, async (req, res) => {
    try {
        const [rows] = await db.query(
            'SELECT id, phone, name, email, role, avatar, is_verified, rating_avg, rating_count, created_at FROM users WHERE id = ?',
            [req.user.id]
        );
        let driverProfile = null;
        if (req.user.role === 'driver') {
            const [dp] = await db.query('SELECT * FROM driver_profiles WHERE user_id = ?', [req.user.id]);
            driverProfile = dp[0] || null;
        }
        res.json({ user: rows[0], driverProfile });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// ========== UPDATE PROFILE ==========
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, email } = req.body;
        await db.query('UPDATE users SET name = COALESCE(?, name), email = COALESCE(?, email) WHERE id = ?',
            [name, email, req.user.id]);
        res.json({ message: 'تم التحديث' });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
