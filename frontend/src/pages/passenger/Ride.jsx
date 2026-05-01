import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { getSocket } from '../../utils/socket';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const STATUS_LABELS = {
    searching: '🔍 جاري البحث عن سائق...',
    accepted: '✅ سائق قبل الرحلة!',
    arriving: '🛺 السائق في الطريق إليك',
    started: '🚀 الرحلة جارية',
    completed: '🎉 وصلت! الرحلة خلصت',
    cancelled: '❌ الرحلة اتلغت'
};

export default function PassengerRide() {
    const navigate = useNavigate();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const driverMarker = useRef(null);
    const [ride, setRide] = useState(null);
    const [rating, setRating] = useState(0);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);

    useEffect(() => {
        loadRide();
        const socket = getSocket();
        if (socket) {
            socket.on('ride_accepted', (data) => loadRide());
            socket.on('ride_status_update', (data) => loadRide());
            socket.on('ride_cancelled', (data) => loadRide());
            socket.on('driver_location', (data) => {
                if (driverMarker.current && mapInstance.current) {
                    driverMarker.current.setLatLng([data.lat, data.lng]);
                }
            });
        }
        return () => {
            if (socket) {
                socket.off('ride_accepted');
                socket.off('ride_status_update');
                socket.off('ride_cancelled');
                socket.off('driver_location');
            }
        };
    }, []);

    useEffect(() => {
        if (!ride || !mapRef.current || mapInstance.current) return;
        const map = L.map(mapRef.current).setView([ride.pickup_lat, ride.pickup_lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        mapInstance.current = map;

        // Pickup marker
        L.marker([ride.pickup_lat, ride.pickup_lng], {
            icon: L.divIcon({ className: '', html: '<div class="marker-dot pickup-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
        }).addTo(map);

        // Dropoff marker
        L.marker([ride.dropoff_lat, ride.dropoff_lng], {
            icon: L.divIcon({ className: '', html: '<div class="marker-dot dropoff-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
        }).addTo(map);

        // Route line
        L.polyline([[ride.pickup_lat, ride.pickup_lng], [ride.dropoff_lat, ride.dropoff_lng]], { color: '#10b981', weight: 3, dashArray: '10 5' }).addTo(map);

        // Driver marker
        if (ride.driver_lat && ride.driver_lng) {
            driverMarker.current = L.marker([ride.driver_lat, ride.driver_lng], {
                icon: L.divIcon({ className: '', html: '<div class="driver-marker">🛺</div>', iconSize: [30, 30], iconAnchor: [15, 15] })
            }).addTo(map);
        }

        map.fitBounds([[ride.pickup_lat, ride.pickup_lng], [ride.dropoff_lat, ride.dropoff_lng]], { padding: [50, 50] });

        return () => { map.remove(); mapInstance.current = null; };
    }, [ride]);

    async function loadRide() {
        try {
            const { data } = await api.get('/rides/active');
            setRide(data);
            if (!data) navigate('/passenger');
        } catch { navigate('/passenger'); }
    }

    async function cancelRide() {
        if (!ride) return;
        try {
            await api.post(`/rides/${ride.id}/cancel`, { reason: 'الراكب لغى' });
            navigate('/passenger');
        } catch {}
    }

    async function submitRating() {
        if (!ride || !rating) return;
        try {
            await api.post(`/rides/${ride.id}/rate`, { rating });
            setRatingSubmitted(true);
            setTimeout(() => navigate('/passenger'), 1500);
        } catch {}
    }

    if (!ride) return <div className="loading-screen">جاري التحميل...</div>;

    return (
        <div className="app-container">
            <div ref={mapRef} className="map-container map-ride"></div>

            <div className="bottom-panel ride-panel">
                <div className="ride-status">
                    <h3>{STATUS_LABELS[ride.status]}</h3>
                    {ride.status === 'searching' && <div className="pulse-animation"></div>}
                </div>

                {ride.driver_name && (
                    <div className="driver-info">
                        <div className="driver-avatar">🛺</div>
                        <div className="driver-details">
                            <h4>{ride.driver_name}</h4>
                            <p>{ride.vehicle_type} - {ride.vehicle_color} - {ride.vehicle_plate}</p>
                            <p>⭐ {ride.driver_rating}</p>
                        </div>
                        <a href={`tel:${ride.driver_phone}`} className="btn btn-call">📞</a>
                    </div>
                )}

                <div className="ride-info-compact">
                    <div className="location-row"><span className="dot green"></span><span>{ride.pickup_address}</span></div>
                    <div className="location-row"><span className="dot red"></span><span>{ride.dropoff_address}</span></div>
                    <div className="ride-fare">{ride.total_fare} جنيه - {ride.payment_method === 'cash' ? 'كاش' : ride.payment_method}</div>
                </div>

                {ride.status === 'completed' && !ratingSubmitted && (
                    <div className="rating-section">
                        <p>قيم السائق</p>
                        <div className="stars">
                            {[1, 2, 3, 4, 5].map(s => (
                                <span key={s} className={`star ${s <= rating ? 'active' : ''}`} onClick={() => setRating(s)}>★</span>
                            ))}
                        </div>
                        <button className="btn btn-primary btn-block" onClick={submitRating} disabled={!rating}>إرسال التقييم</button>
                    </div>
                )}

                {ratingSubmitted && <div className="alert success">شكراً على التقييم!</div>}

                {['searching', 'accepted', 'arriving'].includes(ride.status) && (
                    <button className="btn btn-danger btn-block" onClick={cancelRide}>إلغاء الرحلة</button>
                )}

                {['completed', 'cancelled'].includes(ride.status) && (
                    <button className="btn btn-primary btn-block" onClick={() => navigate('/passenger')}>رحلة جديدة</button>
                )}
            </div>
        </div>
    );
}
