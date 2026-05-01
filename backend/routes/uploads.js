const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { auth, requireRole } = require('../middleware/auth');
const router = express.Router();

// Ensure upload dirs exist
const uploadDir = path.join(__dirname, '../../uploads');
['avatars', 'documents'].forEach(dir => {
    const p = path.join(uploadDir, dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = req.params.type === 'avatar' ? 'avatars' : 'documents';
        cb(null, path.join(uploadDir, type));
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${req.user.id}_${Date.now()}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp/;
        if (allowed.test(path.extname(file.originalname).toLowerCase())) cb(null, true);
        else cb(new Error('نوع الملف مش مدعوم'));
    }
});

// Upload avatar
router.post('/avatar', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'الملف مطلوب' });
        const url = `/uploads/avatars/${req.file.filename}`;
        await db.query('UPDATE users SET avatar = ? WHERE id = ?', [url, req.user.id]);
        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

// Upload driver documents (license, national ID)
router.post('/document/:docType', auth, requireRole('driver'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'الملف مطلوب' });
        const url = `/uploads/documents/${req.file.filename}`;
        const field = req.params.docType === 'license' ? 'license_photo' : 'national_id_photo';
        await db.query(`UPDATE driver_profiles SET ${field} = ? WHERE user_id = ?`, [url, req.user.id]);
        res.json({ url });
    } catch (err) {
        res.status(500).json({ error: 'حصل مشكلة' });
    }
});

module.exports = router;
