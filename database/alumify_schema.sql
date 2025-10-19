-- Alumify Database Schema
CREATE DATABASE IF NOT EXISTS alumify;
USE alumify;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    name VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    privacy_accepted BOOLEAN DEFAULT FALSE,
    privacy_accepted_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Graduate profiles table
CREATE TABLE IF NOT EXISTS graduate_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    permanent_address TEXT,
    telephone VARCHAR(50),
    mobile_number VARCHAR(50),
    civil_status ENUM('Single', 'Married', 'Separated', 'Widow or Widower', 'Single Parent'),
    sex ENUM('Male', 'Female'),
    birthday DATE,
    region_of_origin VARCHAR(50),
    province VARCHAR(100),
    location_type ENUM('City', 'Municipality'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_profile (user_id)
);

-- Educational background table
CREATE TABLE IF NOT EXISTS educational_background (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    degree VARCHAR(255),
    specialization VARCHAR(255),
    college_university VARCHAR(255),
    year_graduated YEAR,
    honors_awards TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_education (user_id)
);

-- Employment data table
CREATE TABLE IF NOT EXISTS employment_data (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    is_employed ENUM('Yes', 'No', 'Never Employed') NOT NULL,
    employment_status ENUM('Regular or Permanent', 'Contractual', 'Temporary', 'Self-employed', 'Casual'),
    present_occupation VARCHAR(255),
    business_line VARCHAR(255),
    place_of_work ENUM('Local', 'Abroad'),
    is_first_job ENUM('Yes', 'No'),
    job_level_first ENUM('Rank or Clerical', 'Professional, Technical or Supervisory', 'Managerial or Executive', 'Self-employed'),
    job_level_current ENUM('Rank or Clerical', 'Professional, Technical or Supervisory', 'Managerial or Executive', 'Self-employed'),
    initial_gross_monthly_earning VARCHAR(50),
    curriculum_relevant ENUM('Yes', 'No'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_employment (user_id)
);

-- Course reasons table
CREATE TABLE IF NOT EXISTS course_reasons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    reason_type VARCHAR(100),
    level ENUM('Undergraduate', 'Graduate'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Unemployment reasons table
CREATE TABLE IF NOT EXISTS unemployment_reasons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Useful competencies table
CREATE TABLE IF NOT EXISTS useful_competencies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    competency VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Curriculum suggestions table
CREATE TABLE IF NOT EXISTS curriculum_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    suggestion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_suggestion (user_id)
);

-- Survey responses table
CREATE TABLE IF NOT EXISTS survey_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_survey (user_id)
);

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    activity_type ENUM('registration', 'login', 'survey_completed', 'profile_updated', 'survey_started', 'survey_updated', 'password_changed') NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default admin user
INSERT IGNORE INTO users (email, password, name, role, privacy_accepted) VALUES 
('admin@alumify.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin', TRUE);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_employment_data_user_id ON employment_data(user_id);
CREATE INDEX IF NOT EXISTS idx_educational_background_user_id ON educational_background(user_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_user_id ON survey_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_educational_background_year_graduated ON educational_background(year_graduated);
CREATE INDEX IF NOT EXISTS idx_educational_background_degree ON educational_background(degree);
