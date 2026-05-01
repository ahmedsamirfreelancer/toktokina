require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 60000,
    pingInterval: 25000
});

// Store io on app
app.set('io', io);

// Trust proxy (behind nginx)
app.set('trust proxy', 1);

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Rate limiting - per IP + per user
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, message: { error: 'محاولات كتير، استنى شوية' } });
app.use(globalLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Serve uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/rides', require('./routes/rides'));
app.use('/api/driver', require('./routes/driver'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/upload', require('./routes/uploads'));
app.use('/api/promo', require('./routes/promo'));
app.use('/api/support', require('./routes/support'));
app.use('/api/favorites', require('./routes/favorites'));

// Terms & Privacy (static JSON)
app.get('/api/terms', (req, res) => res.json({
    terms: 'شروط استخدام توكتوكينا\n\n1. يجب أن يكون عمرك 18 سنة أو أكثر لاستخدام التطبيق.\n2. السائق مسؤول عن سلامة الركاب أثناء الرحلة.\n3. يحق للشركة خصم عمولة 12% من كل رحلة.\n4. يمنع استخدام التطبيق لأي أغراض غير قانونية.\n5. الشركة غير مسؤولة عن أي أضرار خارجة عن إرادتها.\n6. يحق للشركة تعليق أو إلغاء أي حساب يخالف الشروط.\n7. الأسعار قابلة للتغيير حسب العرض والطلب.',
    privacy: 'سياسة الخصوصية\n\n1. نجمع بيانات الموقع لتوفير خدمة التوصيل.\n2. لا نشارك بياناتك الشخصية مع أطراف ثالثة.\n3. نحتفظ بسجل الرحلات لأغراض المحاسبة والأمان.\n4. يمكنك طلب حذف حسابك في أي وقت.\n5. نستخدم التشفير لحماية بيانات الدفع.'
}));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
        res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
    }
});

// Socket.io
const setupSocket = require('./socket/handler');
setupSocket(io, app);

// Start
const PORT = process.env.PORT || 3500;
server.listen(PORT, () => {
    console.log(`🛺 TokTokina server running on port ${PORT}`);
});
