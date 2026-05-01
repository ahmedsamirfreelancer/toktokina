import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(phone, password);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'حصل مشكلة');
        }
        setLoading(false);
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-logo">
                    <div className="logo-icon">🛺</div>
                    <h1>توكتوكينا</h1>
                    <p>توكتوك في ثواني</p>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <div className="alert error">{error}</div>}
                    <div className="form-group">
                        <label>رقم التليفون</label>
                        <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="01xxxxxxxxx" required />
                    </div>
                    <div className="form-group">
                        <label>كلمة السر</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة السر" required />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        {loading ? 'جاري الدخول...' : 'دخول'}
                    </button>
                </form>
                <p className="auth-link">مش عندك حساب؟ <Link to="/register">سجل دلوقتي</Link></p>
            </div>
        </div>
    );
}
