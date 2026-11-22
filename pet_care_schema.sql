CREATE DATABASE IF NOT EXISTS pet_care_bidding
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE pet_care_bidding;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('owner', 'carer') NOT NULL,
  provider_service ENUM('walking', 'bathing', 'grooming', 'feeding', 'sitting') NULL,
  provider_experience TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_username (username),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS pets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  pet_type ENUM('cat', 'dog', 'other') NOT NULL,
  breed VARCHAR(100) NULL,
  age_years SMALLINT UNSIGNED NULL,
  photo_url VARCHAR(2048) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_pets_owner (owner_id),
  CONSTRAINT fk_pets_owner FOREIGN KEY (owner_id)
    REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS care_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id INT UNSIGNED NOT NULL,
  pet_id INT UNSIGNED NOT NULL,
  service ENUM('walking', 'bathing', 'grooming', 'feeding', 'sitting') NOT NULL,
  service_start DATETIME NOT NULL,
  service_end DATETIME NOT NULL,
  budget DECIMAL(10,2) NOT NULL,
  bidding_deadline DATETIME NOT NULL,
  instructions TEXT NULL,
  status ENUM('open', 'closed', 'assigned', 'completed', 'cancelled')
    NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_requests_owner (owner_id),
  KEY idx_requests_pet (pet_id),
  KEY idx_requests_search (status, service, budget),
  CONSTRAINT fk_requests_owner FOREIGN KEY (owner_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_requests_pet FOREIGN KEY (pet_id)
    REFERENCES pets(id) ON DELETE CASCADE,
  CONSTRAINT chk_request_dates CHECK (
    service_end > service_start AND bidding_deadline < service_start
  ),
  CONSTRAINT chk_request_budget CHECK (budget > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bids (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id INT UNSIGNED NOT NULL,
  provider_id INT UNSIGNED NOT NULL,
  proposed_price DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('active', 'withdrawn', 'accepted', 'rejected')
    NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_bid_request_provider (request_id, provider_id),
  KEY idx_bids_provider (provider_id),
  CONSTRAINT fk_bids_request FOREIGN KEY (request_id)
    REFERENCES care_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_bids_provider FOREIGN KEY (provider_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_bid_price CHECK (proposed_price > 0)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id INT UNSIGNED NOT NULL,
  reviewer_id INT UNSIGNED NOT NULL,
  reviewee_id INT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_review_per_request_author (request_id, reviewer_id),
  KEY idx_reviews_reviewee (reviewee_id),
  CONSTRAINT fk_reviews_request FOREIGN KEY (request_id)
    REFERENCES care_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_author FOREIGN KEY (reviewer_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_subject FOREIGN KEY (reviewee_id)
    REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT chk_no_self_review CHECK (reviewer_id <> reviewee_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS request_tags (
  request_id INT UNSIGNED NOT NULL,
  tag VARCHAR(50) NOT NULL,
  PRIMARY KEY (request_id, tag),
  KEY idx_tags_tag (tag),
  CONSTRAINT fk_tags_request FOREIGN KEY (request_id)
    REFERENCES care_requests(id) ON DELETE CASCADE
) ENGINE=InnoDB;

SHOW TABLES;