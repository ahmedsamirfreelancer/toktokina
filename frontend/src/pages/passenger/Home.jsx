import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';
import { getSocket } from '../../utils/socket';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export default function PassengerHome() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const pickupMarker = useRef(null);
    const dropoffMarker = useRef(null);

    const [pickup, setPickup] = useState(null);
    const [dropoff, setDropoff] = useState(null);
    const [pickupAddress, setPickupAddress] = useState('');
    const [dropoffAddress, setDropoffAddress] = useState('');
    const [selectingDropoff, setSelectingDropoff] = useState(false);
    const [estimate, setEstimate] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [activeRide, setActiveRide] = useState(null);

    // Check for active ride
    useEffect(() => {
        api.get('/rides/active').then(({ data }) => {
            if (data) {
                setActiveRide(data);
                navigate('/passenger/ride');
            }
        }).catch(() => {});
    }, []);

    // Initialize map
    useEffect(() => {
        if (mapInstance.current || !window.L) return;

        // Default: Egypt center
        mapInstance.current = L.map(mapRef.current).setView([30.5, 31.2], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
        }).addTo(mapInstance.current);

        // Get user location
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                mapInstance.current.setView([latitude, longitude], 16);
                setPickupLocation(latitude, longitude);
            },
            () => { /* Use default */ },
            { enableHighAccuracy: true }
        );

        mapInstance.current.on('click', (e) => {
            const { lat, lng } = e.latlng;
            if (!pickupMarker.current) {
                setPickupLocation(lat, lng);
            } else if (!dropoffMarker.current) {
                setDropoffLocation(lat, lng);
            }
        });

        return () => {
            if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
        };
    }, []);

    function setPickupLocation(lat, lng) {
        if (pickupMarker.current) mapInstance.current.removeLayer(pickupMarker.current);
        pickupMarker.current = L.marker([lat, lng], {
            icon: L.divIcon({ className: 'marker-pickup', html: '<div class="marker-dot pickup-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
        }).addTo(mapInstance.current);
        setPickup({ lat, lng });
        reverseGeocode(lat, lng, setPickupAddress);
        setSelectingDropoff(true);
    }

    function setDropoffLocation(lat, lng) {
        if (dropoffMarker.current) mapInstance.current.removeLayer(dropoffMarker.current);
        dropoffMarker.current = L.marker([lat, lng], {
            icon: L.divIcon({ className: 'marker-dropoff', html: '<div class="marker-dot dropoff-dot"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
        }).addTo(mapInstance.current);
        setDropoff({ lat, lng });
        reverseGeocode(lat, lng, setDropoffAddress);
        setSelectingDropoff(false);

        // Draw line
        if (pickupMarker.current) {
            const p = pickupMarker.current.getLatLng();
            L.polyline([[p.lat, p.lng], [lat, lng]], { color: '#10b981', weight: 3, dashArray: '10 5' }).addTo(mapInstance.current);
        }
    }

    async function reverseGeocode(lat, lng, setter) {
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`);
            const data = await resp.json();
            setter(data.display_name?.split(',').slice(0, 3).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch {
            setter(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        }
    }

    // Get estimate when both points set
    useEffect(() => {
        if (!pickup || !dropoff) return;
        api.post('/rides/estimate', { pickup_lat: pickup.lat, pickup_lng: pickup.lng, dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng })
            .then(({ data }) => setEstimate(data))
            .catch(() => {});
    }, [pickup, dropoff]);

    const requestRide = async () => {
        if (!pickup || !dropoff) return;
        setLoading(true);
        setError('');
        try {
            const { data } = await api.post('/rides/request', {
                pickup_lat: pickup.lat, pickup_lng: pickup.lng, pickup_address: pickupAddress,
                dropoff_lat: dropoff.lat, dropoff_lng: dropoff.lng, dropoff_address: dropoffAddress,
                payment_method: paymentMethod
            });
            navigate('/passenger/ride');
        } catch (err) {
            setError(err.response?.data?.error || 'حصل مشكلة');
        }
        setLoading(false);
    };

    const resetSelection = () => {
        if (pickupMarker.current) { mapInstance.current.removeLayer(pickupMarker.current); pickupMarker.current = null; }
        if (dropoffMarker.current) { mapInstance.current.removeLayer(dropoffMarker.current); dropoffMarker.current = null; }
        setPickup(null); setDropoff(null); setEstimate(null);
        setPickupAddress(''); setDropoffAddress('');
        // Remove polylines
        mapInstance.current.eachLayer(l => { if (l instanceof L.Polyline && !(l instanceof L.TileLayer)) mapInstance.current.removeLayer(l); });
    };

    return (
        <div className="app-container">
            {/* Header */}
            <header className="app-header">
                <h2>🛺 توكتوكينا</h2>
                <div className="header-actions">
                    <Link to="/passenger/history" className="btn btn-sm">رحلاتي</Link>
                    <button className="btn btn-sm btn-outline" onClick={logout}>خروج</button>
                </div>
            </header>

            {/* Map */}
            <div ref={mapRef} className="map-container"></div>

            {/* Bottom Panel */}
            <div className="bottom-panel">
                {error && <div className="alert error">{error}</div>}

                {!pickup && (
                    <div className="instruction">
                        <p>📍 اضغط على الخريطة لتحديد نقطة الركوب</p>
                    </div>
                )}

                {pickup && !dropoff && (
                    <div className="instruction">
                        <div className="location-row">
                            <span className="dot green"></span>
                            <span>{pickupAddress || 'نقطة الركوب'}</span>
                        </div>
                        <p>📍 اضغط على الخريطة لتحديد نقطة النزول</p>
                    </div>
                )}

                {pickup && dropoff && estimate && (
                    <div className="ride-summary">
                        <div className="location-row">
                            <span className="dot green"></span>
                            <span>{pickupAddress}</span>
                        </div>
                        <div className="location-row">
                            <span className="dot red"></span>
                            <span>{dropoffAddress}</span>
                        </div>
                        <div className="estimate-info">
                            <div className="estimate-item">
                                <span className="label">المسافة</span>
                                <span className="value">{estimate.distance_km} كم</span>
                            </div>
                            <div className="estimate-item">
                                <span className="label">الوقت المتوقع</span>
                                <span className="value">{estimate.duration_min} دقيقة</span>
                            </div>
                            <div className="estimate-item fare">
                                <span className="label">السعر</span>
                                <span className="value">{estimate.total_fare} جنيه</span>
                            </div>
                        </div>

                        <div className="payment-methods">
                            {[
                                { key: 'cash', label: '💵 كاش' },
                                { key: 'visa', label: '💳 فيزا' },
                                { key: 'instapay', label: '🏦 انستاباي' },
                                { key: 'vodafone_cash', label: '📱 فودافون كاش' },
                            ].map(m => (
                                <button key={m.key} className={`payment-btn ${paymentMethod === m.key ? 'active' : ''}`}
                                    onClick={() => setPaymentMethod(m.key)}>{m.label}</button>
                            ))}
                        </div>

                        <div className="actions">
                            <button className="btn btn-primary btn-block" onClick={requestRide} disabled={loading}>
                                {loading ? 'جاري البحث عن سائق...' : `اطلب توكتوك - ${estimate.total_fare} جنيه`}
                            </button>
                            <button className="btn btn-outline btn-block" onClick={resetSelection}>إعادة التحديد</button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
