import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
    const [form, setForm] = useState({ name: '', phone: '', password: '', role: 'passenger', vehicle_plate: '', vehicle_color: '', vehicle_type: 'toktok' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await register(form);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'حصل مشكلة');
        }
        setLoading(false);
    };

    const update = (key, val) => setForm(f => ({ ...f, [key]: val }));

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="logo-icon">🛺</div>
                    <h1>حساب جديد</h1>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div className="alert error">{error}</div>}

                    {/* Role Toggle */}
                    <div className="role-toggle">
                        <button type="button" className={`role-btn ${form.role === 'passenger' ? 'active' : ''}`} onClick={() => update('role', 'passenger')}>
                            🧑 راكب
                        </button>
                        <button type="button" className={`role-btn ${form.role === 'driver' ? 'active' : ''}`} onClick={() => update('role', 'driver')}>
                            🛺 سائق
                        </button>
                    </div>

                    <div className="form-group">
                        <label>الاسم</label>
                        <input value={form.name} onChange={e => update('name', e.target.value)} placeholder="اسمك" required />
                    </div>
                    <div className="form-group">
                        <label>رقم التليفون</label>
                        <input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="01xxxxxxxxx" required />
                    </div>
                    <div className="form-group">
                        <label>كلمة السر</label>
                        <input type="password" value={form.password} onChange={e => update('password', e.target.value)} placeholder="كلمة السر" required minLength={6} />
                    </div>

                    {form.role === 'driver' && (
                        <>
                            <div className="form-group">
                                <label>نوع المركبة</label>
                                <select value={form.vehicle_type} onChange={e => update('vehicle_type', e.target.value)}>
                                    <option value="toktok">توكتوك</option>
                                    <option value="motorcycle">موتوسيكل</option>
                                    <option value="car">سيارة</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>رقم اللوحة</label>
                                <input value={form.vehicle_plate} onChange={e => update('vehicle_plate', e.target.value)} placeholder="رقم اللوحة" required />
                            </div>
                            <div className="form-group">
                                <label>لون المركبة</label>
                                <input value={form.vehicle_color} onChange={e => update('vehicle_color', e.target.value)} placeholder="اللون" />
                            </div>
                        </>
                    )}

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        {loading ? 'جاري التسجيل...' : 'تسجيل'}
                    </button>
                </form>
                <p className="auth-link">عندك حساب؟ <Link to="/login">دخول</Link></p>
            </div>
        </div>
    );
}
