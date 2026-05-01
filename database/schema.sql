-- Darwa Ride - Database Schema
-- Uber-like Tuk-Tuk ride-hailing platform

CREATE DATABASE IF NOT EXISTS darwa_ride CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE darwa_ride;

-- ============================================
-- USERS (both passengers & drivers)
-- ============================================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('passenger', 'driver', 'admin') NOT NULL DEFAULT 'passenger',
    avatar VARCHAR(500) NULL,
    is_verified TINYINT(1) DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    otp_code VARCHAR(6) NULL,
    otp_expires DATETIME NULL,
    rating_avg DECIMAL(3,2) DEFAULT 5.00,
    rating_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone),
    INDEX idx_role (role)
) ENGINE=InnoDB;

-- ============================================
-- DRIVER PROFILES
-- ============================================
CREATE TABLE driver_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    vehicle_type ENUM('toktok', 'motorcycle', 'car') DEFAULT 'toktok',
    vehicle_plate VARCHAR(20) NOT NULL,
    vehicle_color VARCHAR(30) NULL,
    license_number VARCHAR(50) NULL,
    license_photo VARCHAR(500) NULL,
    national_id VARCHAR(20) NULL,
    national_id_photo VARCHAR(500) NULL,
    is_approved TINYINT(1) DEFAULT 0,
    is_online TINYINT(1) DEFAULT 0,
    current_lat DECIMAL(10, 8) NULL,
    current_lng DECIMAL(11, 8) NULL,
    last_location_update DATETIME NULL,
    total_rides INT DEFAULT 0,
    total_earnings DECIMAL(12,2) DEFAULT 0.00,
    wallet_balance DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_online (is_online, is_approved),
    INDEX idx_location (current_lat, current_lng)
) ENGINE=InnoDB;

-- ============================================
-- RIDES
-- ============================================
CREATE TABLE rides (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ride_code VARCHAR(10) NOT NULL UNIQUE,
    passenger_id INT NOT NULL,
    driver_id INT NULL,
    status ENUM(
        'searching',      -- looking for driver
        'accepted',       -- driver accepted
        'arriving',       -- driver on the way to pickup
        'started',        -- ride in progress
        'completed',      -- ride finished
        'cancelled'       -- cancelled by either party
    ) NOT NULL DEFAULT 'searching',

    -- Pickup
    pickup_lat DECIMAL(10, 8) NOT NULL,
    pickup_lng DECIMAL(11, 8) NOT NULL,
    pickup_address VARCHAR(500) NULL,

    -- Dropoff
    dropoff_lat DECIMAL(10, 8) NOT NULL,
    dropoff_lng DECIMAL(11, 8) NOT NULL,
    dropoff_address VARCHAR(500) NULL,

    -- Pricing
    distance_km DECIMAL(8,2) NULL,
    duration_min INT NULL,
    base_fare DECIMAL(8,2) NOT NULL DEFAULT 0,
    distance_fare DECIMAL(8,2) NOT NULL DEFAULT 0,
    total_fare DECIMAL(8,2) NOT NULL DEFAULT 0,
    commission_rate DECIMAL(4,2) DEFAULT 12.00,
    commission_amount DECIMAL(8,2) DEFAULT 0,
    driver_earnings DECIMAL(8,2) DEFAULT 0,

    -- Payment
    payment_method ENUM('cash', 'visa', 'instapay', 'vodafone_cash') DEFAULT 'cash',
    payment_status ENUM('pending', 'paid', 'refunded') DEFAULT 'pending',

    -- Cancellation
    cancelled_by ENUM('passenger', 'driver', 'system') NULL,
    cancel_reason VARCHAR(300) NULL,

    -- Timestamps
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME NULL,
    arrived_at DATETIME NULL,
    started_at DATETIME NULL,
    completed_at DATETIME NULL,
    cancelled_at DATETIME NULL,

    FOREIGN KEY (passenger_id) REFERENCES users(id),
    FOREIGN KEY (driver_id) REFERENCES users(id),
    INDEX idx_status (status),
    INDEX idx_passenger (passenger_id),
    INDEX idx_driver (driver_id),
    INDEX idx_requested (requested_at)
) ENGINE=InnoDB;

-- ============================================
-- RIDE TRACKING (real-time path)
-- ============================================
CREATE TABLE ride_tracking (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ride_id INT NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(6,2) NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    INDEX idx_ride (ride_id)
) ENGINE=InnoDB;

-- ============================================
-- RATINGS
-- ============================================
CREATE TABLE ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ride_id INT NOT NULL,
    from_user_id INT NOT NULL,
    to_user_id INT NOT NULL,
    rating TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (to_user_id) REFERENCES users(id),
    UNIQUE KEY unique_rating (ride_id, from_user_id)
) ENGINE=InnoDB;

-- ============================================
-- TRANSACTIONS (wallet & payments)
-- ============================================
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ride_id INT NULL,
    type ENUM('ride_payment', 'commission', 'withdrawal', 'deposit', 'refund') NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    balance_after DECIMAL(12,2) NOT NULL,
    payment_method ENUM('cash', 'visa', 'instapay', 'vodafone_cash', 'wallet') NULL,
    reference_id VARCHAR(100) NULL,
    notes VARCHAR(300) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (ride_id) REFERENCES rides(id),
    INDEX idx_user (user_id),
    INDEX idx_type (type)
) ENGINE=InnoDB;

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    body VARCHAR(500) NOT NULL,
    type ENUM('ride', 'payment', 'promo', 'system') DEFAULT 'system',
    is_read TINYINT(1) DEFAULT 0,
    data JSON NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_read (user_id, is_read)
) ENGINE=InnoDB;

-- ============================================
-- PRICING CONFIG
-- ============================================
CREATE TABLE pricing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vehicle_type ENUM('toktok', 'motorcycle', 'car') NOT NULL,
    base_fare DECIMAL(8,2) NOT NULL DEFAULT 5.00,
    per_km_fare DECIMAL(8,2) NOT NULL DEFAULT 3.00,
    per_min_fare DECIMAL(8,2) NOT NULL DEFAULT 0.50,
    min_fare DECIMAL(8,2) NOT NULL DEFAULT 10.00,
    surge_multiplier DECIMAL(4,2) DEFAULT 1.00,
    is_active TINYINT(1) DEFAULT 1,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_vehicle (vehicle_type)
) ENGINE=InnoDB;

-- Default pricing
INSERT INTO pricing (vehicle_type, base_fare, per_km_fare, per_min_fare, min_fare) VALUES
('toktok', 5.00, 3.00, 0.50, 10.00),
('motorcycle', 7.00, 4.00, 0.75, 12.00),
('car', 10.00, 5.00, 1.00, 15.00);

-- Admin user
INSERT INTO users (phone, name, password_hash, role, is_verified) VALUES
('01000000000', 'Admin', '$2b$10$placeholder', 'admin', 1);
