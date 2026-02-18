-- ai-tools database schema
-- 运行: mysql -u root ai_tools < src/db/schema.sql

CREATE DATABASE IF NOT EXISTS ai_tools DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ai_tools;

-- 用户表（简化版，配合 is_premium 权限检查）
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  is_premium TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 支付记录表
CREATE TABLE IF NOT EXISTS payment_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  checkout_id VARCHAR(255) UNIQUE,
  order_id VARCHAR(255),
  customer_id VARCHAR(255),
  amount DECIMAL(10,2),
  currency VARCHAR(10) DEFAULT 'USD',
  status ENUM('pending','completed','failed','cancelled','refunded') DEFAULT 'pending',
  payment_method VARCHAR(50),
  creem_metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_order_id (order_id),
  INDEX idx_status (status)
) ENGINE=InnoDB;

-- 提现记录表
CREATE TABLE IF NOT EXISTS payout_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  wise_transfer_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10,2),
  source_currency VARCHAR(10) DEFAULT 'USD',
  target_currency VARCHAR(10) DEFAULT 'CNY',
  wise_quote_id VARCHAR(255),
  wise_recipient_id VARCHAR(255),
  status ENUM('pending','processing','completed','failed','cancelled') DEFAULT 'pending',
  wise_metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_wise_transfer_id (wise_transfer_id)
) ENGINE=InnoDB;
