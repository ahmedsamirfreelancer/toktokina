import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import PassengerHome from './pages/passenger/Home';
import PassengerRide from './pages/passenger/Ride';
import PassengerHistory from './pages/passenger/History';
import DriverHome from './pages/driver/Home';
import DriverEarnings from './pages/driver/Earnings';
import DriverHistory from './pages/driver/History';
import AdminDashboard from './pages/admin/Dashboard';
import AdminDrivers from './pages/admin/Drivers';
import AdminRides from './pages/admin/Rides';
import AdminPricing from './pages/admin/Pricing';

function ProtectedRoute({ children, roles }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" />;
    if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
    return children;
}

export default function App() {
    const { user } = useAuth();

    // Redirect based on role
    const homeRedirect = () => {
        if (!user) return <Navigate to="/login" />;
        if (user.role === 'admin') return <Navigate to="/admin" />;
        if (user.role === 'driver') return <Navigate to="/driver" />;
        return <Navigate to="/passenger" />;
    };

    return (
        <Routes>
            <Route path="/" element={homeRedirect()} />
            <Route path="/login" element={user ? homeRedirect() : <Login />} />
            <Route path="/register" element={user ? homeRedirect() : <Register />} />

            {/* Passenger */}
            <Route path="/passenger" element={<ProtectedRoute roles={['passenger']}><PassengerHome /></ProtectedRoute>} />
            <Route path="/passenger/ride" element={<ProtectedRoute roles={['passenger']}><PassengerRide /></ProtectedRoute>} />
            <Route path="/passenger/history" element={<ProtectedRoute roles={['passenger']}><PassengerHistory /></ProtectedRoute>} />

            {/* Driver */}
            <Route path="/driver" element={<ProtectedRoute roles={['driver']}><DriverHome /></ProtectedRoute>} />
            <Route path="/driver/earnings" element={<ProtectedRoute roles={['driver']}><DriverEarnings /></ProtectedRoute>} />
            <Route path="/driver/history" element={<ProtectedRoute roles={['driver']}><DriverHistory /></ProtectedRoute>} />

            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/drivers" element={<ProtectedRoute roles={['admin']}><AdminDrivers /></ProtectedRoute>} />
            <Route path="/admin/rides" element={<ProtectedRoute roles={['admin']}><AdminRides /></ProtectedRoute>} />
            <Route path="/admin/pricing" element={<ProtectedRoute roles={['admin']}><AdminPricing /></ProtectedRoute>} />
        </Routes>
    );
}
