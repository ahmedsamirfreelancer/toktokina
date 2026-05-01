const db = require('../config/db');

// Haversine distance in km
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function calculateFare(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType = 'toktok') {
    const distance_km = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    // Estimate 1.3x straight-line for road distance
    const road_distance = distance_km * 1.3;
    // Estimate duration: avg 20 km/h for toktok
    const duration_min = Math.round((road_distance / 20) * 60);

    const [pricing] = await db.query('SELECT * FROM pricing WHERE vehicle_type = ? AND is_active = 1', [vehicleType]);
    const p = pricing[0] || { base_fare: 5, per_km_fare: 3, per_min_fare: 0.5, min_fare: 10, surge_multiplier: 1 };

    let base_fare = parseFloat(p.base_fare);
    let distance_fare = road_distance * parseFloat(p.per_km_fare);
    let time_fare = duration_min * parseFloat(p.per_min_fare);
    let total = (base_fare + distance_fare + time_fare) * parseFloat(p.surge_multiplier);
    total = Math.max(total, parseFloat(p.min_fare));
    total = Math.round(total * 100) / 100;

    return {
        distance_km: Math.round(road_distance * 100) / 100,
        duration_min,
        base_fare: Math.round(base_fare * 100) / 100,
        distance_fare: Math.round(distance_fare * 100) / 100,
        time_fare: Math.round(time_fare * 100) / 100,
        surge_multiplier: parseFloat(p.surge_multiplier),
        total_fare: total
    };
}

function generateRideCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

module.exports = { calculateFare, haversineDistance, generateRideCode };
