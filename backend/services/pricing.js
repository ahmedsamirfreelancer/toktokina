const db = require('../config/db');
const https = require('https');
const http = require('http');

// Haversine distance in km
function haversineDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Get real road distance from OSRM
async function getRouteDistance(lat1, lng1, lat2, lng2) {
    return new Promise((resolve) => {
        const url = `http://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}?overview=false`;
        const req = http.get(url, { timeout: 5000 }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.code === 'Ok' && json.routes?.length) {
                        resolve({
                            distance_km: Math.round(json.routes[0].distance / 10) / 100,
                            duration_min: Math.round(json.routes[0].duration / 60)
                        });
                    } else {
                        resolve(null);
                    }
                } catch { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
}

async function calculateFare(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType = 'toktok') {
    // Try OSRM first, fallback to haversine
    const route = await getRouteDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    let road_distance, duration_min;

    if (route) {
        road_distance = route.distance_km;
        duration_min = route.duration_min;
    } else {
        const straight = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
        road_distance = straight * 1.3;
        duration_min = Math.round((road_distance / 20) * 60);
    }

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

// Find nearby drivers within radius (km)
async function findNearbyDrivers(lat, lng, radiusKm = 5, vehicleType = null) {
    // Using MySQL spatial approximation (1 degree ≈ 111 km)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(lat * Math.PI / 180));

    let query = `
        SELECT dp.user_id, dp.current_lat, dp.current_lng, dp.vehicle_type, dp.vehicle_plate, dp.vehicle_color,
               u.name, u.phone, u.rating_avg,
               (6371 * acos(cos(radians(?)) * cos(radians(dp.current_lat)) * cos(radians(dp.current_lng) - radians(?)) + sin(radians(?)) * sin(radians(dp.current_lat)))) AS distance_km
        FROM driver_profiles dp
        JOIN users u ON u.id = dp.user_id
        WHERE dp.is_online = 1 AND dp.is_approved = 1 AND u.is_active = 1
          AND dp.current_lat BETWEEN ? AND ?
          AND dp.current_lng BETWEEN ? AND ?
          AND dp.user_id NOT IN (SELECT driver_id FROM rides WHERE driver_id IS NOT NULL AND status IN ('accepted', 'arriving', 'started'))
    `;
    const params = [lat, lng, lat, lat - latDelta, lat + latDelta, lng - lngDelta, lng + lngDelta];

    if (vehicleType) {
        query += ' AND dp.vehicle_type = ?';
        params.push(vehicleType);
    }

    query += ' HAVING distance_km <= ? ORDER BY distance_km ASC LIMIT 20';
    params.push(radiusKm);

    const [drivers] = await db.query(query, params);
    return drivers;
}

// Auto surge based on demand/supply ratio
async function calculateSurge(lat, lng, radiusKm = 3) {
    const drivers = await findNearbyDrivers(lat, lng, radiusKm);
    const [pending] = await db.query(
        `SELECT COUNT(*) as cnt FROM rides WHERE status = 'searching' AND pickup_lat BETWEEN ? AND ? AND pickup_lng BETWEEN ? AND ?`,
        [lat - 0.03, lat + 0.03, lng - 0.03, lng + 0.03]
    );
    const demand = (pending[0]?.cnt || 0) + 1;
    const supply = Math.max(drivers.length, 1);
    const ratio = demand / supply;

    if (ratio > 3) return 2.0;
    if (ratio > 2) return 1.5;
    if (ratio > 1.5) return 1.25;
    return 1.0;
}

function generateRideCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    return code;
}

module.exports = { calculateFare, haversineDistance, getRouteDistance, findNearbyDrivers, calculateSurge, generateRideCode };
