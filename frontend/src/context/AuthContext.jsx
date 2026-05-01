import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';
import { connectSocket, disconnectSocket } from '../utils/socket';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('darwa_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('darwa_token');
        if (token && user) connectSocket(token);
        return () => disconnectSocket();
    }, [user]);

    const login = async (phone, password) => {
        const { data } = await api.post('/auth/login', { phone, password });
        localStorage.setItem('darwa_token', data.token);
        localStorage.setItem('darwa_user', JSON.stringify(data.user));
        setUser(data.user);
        connectSocket(data.token);
        return data;
    };

    const register = async (formData) => {
        const { data } = await api.post('/auth/register', formData);
        localStorage.setItem('darwa_token', data.token);
        localStorage.setItem('darwa_user', JSON.stringify(data.user));
        setUser(data.user);
        connectSocket(data.token);
        return data;
    };

    const logout = () => {
        localStorage.removeItem('darwa_token');
        localStorage.removeItem('darwa_user');
        disconnectSocket();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
