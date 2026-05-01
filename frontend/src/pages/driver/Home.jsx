import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { getSocket } from '../../utils/socket';

export default function DriverHome() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const [isOnline, setIsOnline] = useState(false);
    const [rideRequests, setRideRequests] = useState([]);
    const [activeRide, setActiveRide] = useState(null);
    const [earnings, setEarnings] = useState({ total_rides: 0, total_earnings: 0 });
    const [location, setLocation] = useState(null);

    // Check active ride
    useEffect(() => {
        api.get('/rides/active').then(({ data }) => { if (data) setActiveRide(data); }).catch(() => {});
        api.get('/driver/earnings').then(({ data }) => setEarnings(data.stats)).catch(() => {});
    }, []);

    // Init map
    useEffect(() => {
        if (mapInstance.current || !mapRef.current || !window.L) return;
        mapInstance.current = window.L.map(mapRef.current).setView([30.5, 31.2], 14);
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);

        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            mapInstance.current.setView([latitude, longitude], 16);
            setLocation({ lat: latitude, lng: longitude });
        }, () => {}, { enableHighAccuracy: true });

        return () => { if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; } };
    }, []);

    // Socket events
    useEffect(() => {
        const socket = getSocket();
        if (!socket) return;

        socket.on('new_ride_request', (data) => {
            setRideRequests(prev => {
                if (prev.find(r => r.ride_id === data.ride_id)) return prev;
                return [data, ...prev];
            });
            // Play sound
            try { new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ==').play(); } catch {}
        });
        socket.on('ride_taken', (data) => {
            setRideRequests(prev => prev.filter(r => r.ride_id !== data.ride_id));
        });
        socket.on('ride_cancelled', () => { setActiveRide(null); });

        return () => { socket.off('new_ride_request'); socket.off('ride_taken'); socket.off('ride_cancelled'); };
    }, []);

    // Location tracking when online
    useEffect(() => {
        if (!isOnline) return;
        const watchId = navigator.geolocation.watchPosition(pos => {
            const { latitude, longitude } = pos.coords;
            setLocation({ lat: latitude, lng: longitude });
            const socket = getSocket();
            if (socket) socket.emit('driver_location', { lat: latitude, lng: longitude, speed: pos.coords.speed });
        }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });

        return () => navigator.geolocation.clearWatch(watchId);
    }, [isOnline]);

    const toggleOnline = async () => {
        try {
            const { data } = await api.post('/driver/toggle-online', { is_online: !isOnline, lat: location?.lat, lng: location?.lng });
            setIsOnline(data.is_online);
        } catch {}
    };

    const acceptRide = async (rideId) => {
        try {
            await api.post(`/rides/${rideId}/accept`);
            setRideRequests([]);
            const { data } = await api.get('/rides/active');
            setActiveRide(data);
        } catch (err) {
            setRideRequests(prev => prev.filter(r => r.ride_id !== rideId));
        }
    };

    const updateRideStatus = async (status) => {
        if (!activeRide) return;
        try {
            await api.post(`/rides/${activeRide.id}/status`, { status });
            if (status === 'completed') {
                setActiveRide(null);
                api.get('/driver/earnings').then(({ data }) => setEarnings(data.stats)).catch(() => {});
            } else {
                const { data } = await api.get('/rides/active');
                setActiveRide(data);
            }
        } catch {}
    };

    const nextStatus = { accepted: 'arriving', arriving: 'started', started: 'completed' };
    const nextLabel = { accepted: 'وصلت لنقطة الركوب', arriving: 'ابدأ الرحلة', started: 'الرحلة خلصت' };

    return (
        <div className="app-container">
            <header className="app-header">
                <h2>🛺 سائق</h2>
                <div className="header-actions">
                    <Link to="/driver/earnings" className="btn btn-sm">💰 الأرباح</Link>
                    <Link to="/driver/history" className="btn btn-sm">📋 رحلاتي</Link>
                    <button className="btn btn-sm btn-outline" onClick={logout}>خروج</button>
                </div>
            </header>

            <div ref={mapRef} className="map-container"></div>

            <div className="bottom-panel">
                {/* Online Toggle */}
                <div className="online-toggle" onClick={toggleOnline}>
                    <div className={`toggle-switch ${isOnline ? 'active' : ''}`}>
                        <div className="toggle-knob"></div>
                    </div>
                    <span className={isOnline ? 'text-green' : 'text-gray'}>{isOnline ? 'أونلاين - بتستقبل طلبات' : 'أوفلاين'}</span>
                </div>

                {/* Today Stats */}
                <div className="driver-stats">
                    <div className="stat">
                        <span className="stat-value">{earnings.total_rides || 0}</span>
                        <span className="stat-label">رحلة النهارده</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value">{earnings.total_earnings || 0} ج</span>
                        <span className="stat-label">أرباح النهارده</span>
                    </div>
                </div>

                {/* Active Ride */}
                {activeRide && (
                    <div className="active-ride-card">
                        <h4>رحلة جارية - {activeRide.ride_code}</h4>
                        <div className="location-row"><span className="dot green"></span><span>{activeRide.pickup_address}</span></div>
                        <div className="location-row"><span className="dot red"></span><span>{activeRide.dropoff_address}</span></div>
                        <div className="ride-fare">{activeRide.total_fare} جنيه - {activeRide.payment_method === 'cash' ? 'كاش' : activeRide.payment_method}</div>
                        <div className="ride-passenger">
                            <span>{activeRide.passenger_name}</span>
                            <a href={`tel:${activeRide.passenger_phone}`} className="btn btn-call">📞</a>
                        </div>
                        {nextStatus[activeRide.status] && (
                            <button className="btn btn-primary btn-block" onClick={() => updateRideStatus(nextStatus[activeRide.status])}>
                                {nextLabel[activeRide.status]}
                            </button>
                        )}
                    </div>
                )}

                {/* Ride Requests */}
                {!activeRide && rideRequests.map(req => (
                    <div key={req.ride_id} className="ride-request-card">
                        <div className="request-header">
                            <span className="request-fare">{req.fare} جنيه</span>
                            <span className="request-payment">{req.payment_method === 'cash' ? '💵 كاش' : req.payment_method}</span>
                        </div>
                        <div className="location-row"><span className="dot green"></span><span>{req.pickup?.address || 'نقطة الركوب'}</span></div>
                        <div className="location-row"><span className="dot red"></span><span>{req.dropoff?.address || 'نقطة النزول'}</span></div>
                        <button className="btn btn-primary btn-block" onClick={() => acceptRide(req.ride_id)}>اقبل الرحلة</button>
                    </div>
                ))}

                {isOnline && !activeRide && !rideRequests.length && (
                    <p className="empty-state">مفيش طلبات دلوقتي... استنى شوية</p>
                )}
            </div>
        </div>
    );
}
