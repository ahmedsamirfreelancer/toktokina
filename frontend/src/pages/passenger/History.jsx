import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function PassengerHistory() {
    const [rides, setRides] = useState([]);

    useEffect(() => {
        api.get('/rides/my-rides').then(({ data }) => setRides(data)).catch(() => {});
    }, []);

    const statusLabel = { searching: 'بحث', accepted: 'مقبولة', arriving: 'في الطريق', started: 'جارية', completed: 'مكتملة', cancelled: 'ملغية' };
    const statusClass = { completed: 'success', cancelled: 'danger', started: 'warning' };

    return (
        <div className="app-container">
            <header className="app-header">
                <Link to="/passenger" className="btn btn-sm">← رجوع</Link>
                <h2>رحلاتي</h2>
                <div></div>
            </header>
            <div className="page-content">
                {!rides.length && <p className="empty-state">لسه ما عملتش رحلات</p>}
                {rides.map(r => (
                    <div key={r.id} className="ride-card">
                        <div className="ride-card-header">
                            <span className={`badge ${statusClass[r.status] || 'info'}`}>{statusLabel[r.status]}</span>
                            <span className="ride-date">{new Date(r.requested_at).toLocaleDateString('ar-EG')}</span>
                        </div>
                        <div className="ride-card-body">
                            <div className="location-row"><span className="dot green"></span><span>{r.pickup_address || 'نقطة الركوب'}</span></div>
                            <div className="location-row"><span className="dot red"></span><span>{r.dropoff_address || 'نقطة النزول'}</span></div>
                        </div>
                        <div className="ride-card-footer">
                            <span>{r.total_fare} جنيه</span>
                            <span>{r.distance_km} كم</span>
                            {r.other_name && <span>السائق: {r.other_name}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
