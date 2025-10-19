-- AlumLink360 Database Schema
CREATE DATABASE IF NOT EXISTS alumlink360;
USE alumlink360;

-- Users table for authentication
CREATE TABLE users (
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
CREATE TABLE graduate_profiles (
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
    profile_photo VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Educational background table
CREATE TABLE educational_background (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    degree VARCHAR(255),
    specialization VARCHAR(255),
    college_university VARCHAR(255),
    year_graduated YEAR,
    honors_awards TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Professional examinations table
CREATE TABLE professional_examinations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    exam_name VARCHAR(255),
    date_taken DATE,
    rating VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Course reasons table
CREATE TABLE course_reasons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    reason_type VARCHAR(100),
    level ENUM('Undergraduate', 'Graduate'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Training and advance studies table
CREATE TABLE training_studies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255),
    duration VARCHAR(100),
    credits_earned VARCHAR(100),
    institution VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Employment data table
CREATE TABLE employment_data (
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Unemployment reasons table
CREATE TABLE unemployment_reasons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Job reasons table
CREATE TABLE job_reasons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    reason_type ENUM('staying', 'accepting', 'changing'),
    reason VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Job search methods table
CREATE TABLE job_search_methods (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    method VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Useful competencies table
CREATE TABLE useful_competencies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    competency VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Curriculum suggestions table
CREATE TABLE curriculum_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    suggestion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Survey responses table for tracking completion
CREATE TABLE survey_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Activity logs table for recent activities
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    activity_type ENUM('registration', 'login', 'survey_completed', 'profile_updated', 'survey_started') NOT NULL,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Reports table for generated reports
CREATE TABLE generated_reports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_user_id INT NOT NULL,
    report_type ENUM('individual_profile', 'employment_summary', 'graduation_batch', 'program_analysis') NOT NULL,
    report_title VARCHAR(255),
    report_data JSON,
    file_path VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default admin user
INSERT INTO users (email, password, name, role, privacy_accepted) VALUES 
('admin@alumlink360.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin', TRUE);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_employment_data_user_id ON employment_data(user_id);
CREATE INDEX idx_educational_background_user_id ON educational_background(user_id);
CREATE INDEX idx_survey_responses_user_id ON survey_responses(user_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX idx_educational_background_year_graduated ON educational_background(year_graduated);
CREATE INDEX idx_educational_background_degree ON educational_background(degree);
