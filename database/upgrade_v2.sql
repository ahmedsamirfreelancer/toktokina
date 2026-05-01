USE darwa_ride;

-- Push subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    endpoint VARCHAR(500) NOT NULL UNIQUE,
    p256dh VARCHAR(200) NOT NULL,
    auth_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- Promo codes
CREATE TABLE IF NOT EXISTS promo_codes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    discount_type ENUM('percentage', 'fixed') DEFAULT 'percentage',
    discount_value DECIMAL(8,2) NOT NULL,
    max_discount DECIMAL(8,2) NULL,
    max_uses INT NULL,
    used_count INT DEFAULT 0,
    is_active TINYINT(1) DEFAULT 1,
    expires_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Promo usage tracking
CREATE TABLE IF NOT EXISTS promo_usage (
    id INT AUTO_INCREMENT PRIMARY KEY,
    promo_id INT NOT NULL,
    user_id INT NOT NULL,
    ride_id INT NULL,
    discount_amount DECIMAL(8,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (promo_id) REFERENCES promo_codes(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_usage (promo_id, user_id)
) ENGINE=InnoDB;

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    ride_id INT NULL,
    subject VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    admin_reply TEXT NULL,
    status ENUM('open', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Favorite places
CREATE TABLE IF NOT EXISTS favorite_places (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    lat DECIMAL(10, 8) NOT NULL,
    lng DECIMAL(11, 8) NOT NULL,
    address VARCHAR(300) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- Chat messages
CREATE TABLE IF NOT EXISTS ride_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ride_id INT NOT NULL,
    from_user_id INT NOT NULL,
    message VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(id) ON DELETE CASCADE,
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    INDEX idx_ride (ride_id)
) ENGINE=InnoDB;

-- Add referral columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) NULL UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INT NULL;

-- Withdrawal requests
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    method ENUM('vodafone_cash', 'instapay', 'bank') NOT NULL,
    account_number VARCHAR(50) NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
    admin_note VARCHAR(300) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME NULL,
    FOREIGN KEY (driver_id) REFERENCES users(id),
    INDEX idx_status (status)
) ENGINE=InnoDB;

-- Performance indexes
ALTER TABLE rides ADD INDEX IF NOT EXISTS idx_pickup_location (pickup_lat, pickup_lng);
ALTER TABLE rides ADD INDEX IF NOT EXISTS idx_completed_date (completed_at);
ALTER TABLE driver_profiles ADD INDEX IF NOT EXISTS idx_online_approved (is_online, is_approved);
ALTER TABLE driver_profiles ADD INDEX IF NOT EXISTS idx_lat_lng (current_lat, current_lng);

-- Default promo code
INSERT IGNORE INTO promo_codes (code, discount_type, discount_value, max_discount, max_uses) VALUES
('WELCOME', 'percentage', 20, 10, 1000),
('FIRST', 'fixed', 5, NULL, 500);
