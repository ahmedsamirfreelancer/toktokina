import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function AdminDashboard() {
    const { logout } = useAuth();
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api.get('/admin/stats').then(({ data }) => setStats(data)).catch(() => {});
    }, []);

    if (!stats) return <div className="loading-screen">جاري التحميل...</div>;

    return (
        <div className="app-container">
            <header className="app-header">
                <h2>🛺 لوحة التحكم</h2>
                <div className="header-actions">
                    <button className="btn btn-sm btn-outline" onClick={logout}>خروج</button>
                </div>
            </header>
            <div className="page-content">
                <div className="admin-nav">
                    <Link to="/admin/drivers" className="admin-nav-btn">👨‍✈️ السائقين</Link>
                    <Link to="/admin/rides" className="admin-nav-btn">🛺 الرحلات</Link>
                    <Link to="/admin/pricing" className="admin-nav-btn">💰 الأسعار</Link>
                </div>

                <div className="stats-grid">
                    <div className="stat-card green">
                        <span className="stat-number">{stats.today.rides}</span>
                        <span className="stat-label">رحلات النهارده</span>
                    </div>
                    <div className="stat-card blue">
                        <span className="stat-number">{stats.today.commission} ج</span>
                        <span className="stat-label">عمولة النهارده</span>
                    </div>
                    <div className="stat-card orange">
                        <span className="stat-number">{stats.online_drivers}</span>
                        <span className="stat-label">سائقين أونلاين</span>
                    </div>
                    <div className="stat-card purple">
                        <span className="stat-number">{stats.rides.active}</span>
                        <span className="stat-label">رحلات نشطة</span>
                    </div>
                </div>

                <h3 className="section-title">إحصائيات عامة</h3>
                <div className="stats-grid">
                    <div className="stat-card">
                        <span className="stat-number">{stats.users.passengers}</span>
                        <span className="stat-label">راكب</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-number">{stats.users.drivers}</span>
                        <span className="stat-label">سائق</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-number">{stats.rides.completed}</span>
                        <span className="stat-label">رحلة مكتملة</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-number">{stats.revenue.total_commission} ج</span>
                        <span className="stat-label">إجمالي العمولات</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-number">{stats.revenue.total_fares} ج</span>
                        <span className="stat-label">إجمالي الأجرة</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-number">{stats.rides.cancelled}</span>
                        <span className="stat-label">رحلة ملغية</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
