import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function AdminRides() {
    const [rides, setRides] = useState([]);
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        api.get(`/admin/rides?status=${filter}&page=${page}`).then(({ data }) => {
            setRides(data.rides);
            setTotal(data.total);
        }).catch(() => {});
    }, [filter, page]);

    const statusLabel = { searching: 'بحث', accepted: 'مقبولة', arriving: 'في الطريق', started: 'جارية', completed: 'مكتملة', cancelled: 'ملغية' };
    const statusClass = { completed: 'success', cancelled: 'danger', started: 'warning', searching: 'info' };

    return (
        <div className="app-container">
            <header className="app-header">
                <Link to="/admin" className="btn btn-sm">← رجوع</Link>
                <h2>الرحلات ({total})</h2>
                <div></div>
            </header>
            <div className="page-content">
                <div className="filter-tabs">
                    {[['', 'الكل'], ['searching', 'بحث'], ['started', 'جارية'], ['completed', 'مكتملة'], ['cancelled', 'ملغية']].map(([key, label]) => (
                        <button key={key} className={`tab ${filter === key ? 'active' : ''}`} onClick={() => { setFilter(key); setPage(1); }}>{label}</button>
                    ))}
                </div>

                {rides.map(r => (
                    <div key={r.id} className="ride-card">
                        <div className="ride-card-header">
                            <span className="ride-code">{r.ride_code}</span>
                            <span className={`badge ${statusClass[r.status] || 'info'}`}>{statusLabel[r.status]}</span>
                        </div>
                        <div className="ride-card-body">
                            <p>🧑 {r.passenger_name || '-'} → 🛺 {r.driver_name || 'بدون سائق'}</p>
                            <div className="location-row"><span className="dot green"></span><span>{r.pickup_address || '-'}</span></div>
                            <div className="location-row"><span className="dot red"></span><span>{r.dropoff_address || '-'}</span></div>
                        </div>
                        <div className="ride-card-footer">
                            <span>{r.total_fare} ج</span>
                            <span>عمولة: {r.commission_amount} ج</span>
                            <span>{r.distance_km} كم</span>
                            <span>{new Date(r.requested_at).toLocaleDateString('ar-EG')}</span>
                        </div>
                    </div>
                ))}

                {total > 20 && (
                    <div className="pagination">
                        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</button>
                        <span>صفحة {page}</span>
                        <button disabled={rides.length < 20} onClick={() => setPage(p => p + 1)}>التالي</button>
                    </div>
                )}
            </div>
        </div>
    );
}
