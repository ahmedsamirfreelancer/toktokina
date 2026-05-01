import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function DriverEarnings() {
    const [period, setPeriod] = useState('today');
    const [data, setData] = useState(null);

    useEffect(() => {
        api.get(`/driver/earnings?period=${period}`).then(({ data }) => setData(data)).catch(() => {});
    }, [period]);

    if (!data) return <div className="loading-screen">جاري التحميل...</div>;

    return (
        <div className="app-container">
            <header className="app-header">
                <Link to="/driver" className="btn btn-sm">← رجوع</Link>
                <h2>💰 الأرباح</h2>
                <div></div>
            </header>
            <div className="page-content">
                <div className="period-tabs">
                    {[['today', 'النهارده'], ['week', 'الأسبوع'], ['month', 'الشهر']].map(([key, label]) => (
                        <button key={key} className={`tab ${period === key ? 'active' : ''}`} onClick={() => setPeriod(key)}>{label}</button>
                    ))}
                </div>

                <div className="earnings-grid">
                    <div className="earnings-card main">
                        <span className="earnings-value">{data.stats.total_earnings} ج</span>
                        <span className="earnings-label">صافي الأرباح</span>
                    </div>
                    <div className="earnings-card">
                        <span className="earnings-value">{data.stats.total_rides}</span>
                        <span className="earnings-label">عدد الرحلات</span>
                    </div>
                    <div className="earnings-card">
                        <span className="earnings-value">{data.stats.total_fares} ج</span>
                        <span className="earnings-label">إجمالي الأجرة</span>
                    </div>
                    <div className="earnings-card">
                        <span className="earnings-value">{data.stats.total_commission} ج</span>
                        <span className="earnings-label">العمولة (12%)</span>
                    </div>
                </div>

                <div className="wallet-card">
                    <h3>المحفظة</h3>
                    <div className="wallet-balance">{data.wallet?.wallet_balance || 0} جنيه</div>
                    <p className="wallet-note">إجمالي الأرباح الكلية: {data.wallet?.total_earnings || 0} جنيه</p>
                </div>
            </div>
        </div>
    );
}
