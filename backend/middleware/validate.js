// Input sanitization
function sanitize(str) {
    if (typeof str !== 'string') return str;
    return str.replace(/[<>]/g, '').trim();
}

function sanitizeBody(req, res, next) {
    if (req.body && typeof req.body === 'object') {
        for (const key of Object.keys(req.body)) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = sanitize(req.body[key]);
            }
        }
    }
    next();
}

function validatePhone(phone) {
    return /^01[0-9]{9}$/.test(phone);
}

function validateCoords(lat, lng) {
    return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

module.exports = { sanitizeBody, validatePhone, validateCoords, sanitize };
