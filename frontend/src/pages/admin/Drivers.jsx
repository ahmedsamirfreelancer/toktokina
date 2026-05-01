import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function AdminDrivers() {
    const [drivers, setDrivers] = useState([]);
    const [filter, setFilter] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => { load(); }, [filter, page]);

    async function load() {
        const { data } = await api.get(`/admin/drivers?status=${filter}&page=${page}`);
        setDrivers(data.drivers);
        setTotal(data.total);
    }

    async function approve(id) {
        await api.post(`/admin/drivers/${id}/approve`);
        load();
    }

    async function block(id) {
        if (!confirm('متأكد إنك عايز تحظر السائق ده؟')) return;
        await api.post(`/admin/drivers/${id}/block`);
        load();
    }

    return (
        <div className="app-container">
            <header className="app-header">
                <Link to="/admin" className="btn btn-sm">← رجوع</Link>
                <h2>السائقين ({total})</h2>
                <div></div>
            </header>
            <div className="page-content">
                <div className="filter-tabs">
                    {[['', 'الكل'], ['pending', 'في الانتظار'], ['approved', 'مفعلين']].map(([key, label]) => (
                        <button key={key} className={`tab ${filter === key ? 'active' : ''}`} onClick={() => { setFilter(key); setPage(1); }}>{label}</button>
                    ))}
                </div>

                {drivers.map(d => (
                    <div key={d.id} className="driver-card">
                        <div className="driver-card-header">
                            <h4>{d.name}</h4>
                            <span className={`badge ${d.is_approved ? 'success' : 'warning'}`}>{d.is_approved ? 'مفعل' : 'في الانتظار'}</span>
                        </div>
                        <div className="driver-card-body">
                            <p>📞 {d.phone}</p>
                            <p>🛺 {d.vehicle_type} - {d.vehicle_plate} - {d.vehicle_color}</p>
                            <p>⭐ {d.rating_avg} | 🛺 {d.total_rides} رحلة | 💰 {d.total_earnings} ج</p>
                            <p>{d.is_online ? '🟢 أونلاين' : '⚫ أوفلاين'}</p>
                        </div>
                        <div className="driver-card-actions">
                            {!d.is_approved && <button className="btn btn-primary btn-sm" onClick={() => approve(d.id)}>تفعيل</button>}
                            {d.is_active ? <button className="btn btn-danger btn-sm" onClick={() => block(d.id)}>حظر</button> : <span className="badge danger">محظور</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
