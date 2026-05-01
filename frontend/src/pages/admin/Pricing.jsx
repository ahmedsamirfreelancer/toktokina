import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

export default function AdminPricing() {
    const [pricing, setPricing] = useState([]);
    const [saving, setSaving] = useState(null);

    useEffect(() => {
        api.get('/admin/pricing').then(({ data }) => setPricing(data)).catch(() => {});
    }, []);

    const typeLabel = { toktok: '🛺 توكتوك', motorcycle: '🏍️ موتوسيكل', car: '🚗 سيارة' };

    const update = (idx, field, value) => {
        setPricing(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
    };

    const save = async (item) => {
        setSaving(item.id);
        try {
            await api.put(`/admin/pricing/${item.id}`, item);
        } catch {}
        setSaving(null);
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <Link to="/admin" className="btn btn-sm">← رجوع</Link>
                <h2>الأسعار</h2>
                <div></div>
            </header>
            <div className="page-content">
                {pricing.map((p, idx) => (
                    <div key={p.id} className="pricing-card">
                        <h3>{typeLabel[p.vehicle_type]}</h3>
                        <div className="pricing-fields">
                            <div className="form-group">
                                <label>سعر الفتح (جنيه)</label>
                                <input type="number" value={p.base_fare} onChange={e => update(idx, 'base_fare', e.target.value)} step="0.5" />
                            </div>
                            <div className="form-group">
                                <label>سعر الكيلو (جنيه)</label>
                                <input type="number" value={p.per_km_fare} onChange={e => update(idx, 'per_km_fare', e.target.value)} step="0.5" />
                            </div>
                            <div className="form-group">
                                <label>سعر الدقيقة (جني��)</label>
                                <input type="number" value={p.per_min_fare} onChange={e => update(idx, 'per_min_fare', e.target.value)} step="0.1" />
                            </div>
                            <div className="form-group">
                                <label>الحد الأدنى (جنيه)</label>
                                <input type="number" value={p.min_fare} onChange={e => update(idx, 'min_fare', e.target.value)} step="1" />
                            </div>
                            <div className="form-group">
                                <label>معامل الذروة</label>
                                <input type="number" value={p.surge_multiplier} onChange={e => update(idx, 'surge_multiplier', e.target.value)} step="0.1" min="1" />
                            </div>
                        </div>
                        <button className="btn btn-primary btn-block" onClick={() => save(p)} disabled={saving === p.id}>
                            {saving === p.id ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
