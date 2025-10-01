[![中文](https://img.shields.io/badge/中文-README-blue)](README_zh_tw.md)

# WSSE Student Enrollment System

## Overview

WSSE Student Enrollment System is a full-stack server application developed as a learning project for the Web Service Software Engineering course. This project implements OpenAPI specifications to build a student enrollment system with robust security and authorization features. It serves as a comprehensive example of modern web service development, incorporating RESTful APIs, authentication, and authorization mechanisms.

## Features

* **OpenAPI Specification**: Complete API documentation using OpenAPI 3.1 for student enrollment operations.
* **Security Implementation**: JWT-based authentication and role-based authorization for secure access.
* **Student Management**: CRUD operations for student records, including enrollment and course registration.
* **Authorization Levels**: Different access levels for students, instructors, and administrators.
* **API Documentation**: Interactive API documentation accessible via Swagger UI.
* **Logging and Monitoring**: Comprehensive logging for API requests and system activities.
* **Database Integration**: Persistent storage for student data, courses, and enrollment records.
* **Error Handling**: Robust error handling and validation for API endpoints.

## Screenshots

**Currently no screenshots available.**

## Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/unforgettableeternalproject/wsse-student-enrollment-labs-2025
   cd wsse-student-enrollment-labs-2025
   ```

2. **Install dependencies**:

   * For Node.js backend:
     ```bash
     npm install
     ```
   * For Java backend (if applicable):
     ```bash
     mvn install
     ```

3. **Set up the database**:

   * Configure your database connection in `config/database.js` or equivalent.
   * Run database migrations:
     ```bash
     npm run migrate
     ```

4. **Configure environment variables**:

   * Copy `.env.example` to `.env` and fill in your configuration:
     - JWT_SECRET
     - DATABASE_URL
     - API_PORT

5. **Run the application**:

   * Start the server:
     ```bash
     npm start
     ```
   * Access the API at `http://localhost:3000`
   * View API documentation at `http://localhost:3000/api-docs`

## Usage

### Authentication

 - TO-DO

### Student Enrollment

 - TO-DO

### API Documentation

Access the interactive API documentation at `/api-docs` to explore all available endpoints, test requests, and view response schemas.

## Lab Progression

This project will evolve throughout the course with new features added in each lab session:

- **Lab 1**: Basic OpenAPI specification
- **Lab 2**: To be discovered
- **Lab 3**: To be discovered
- **Lab 4**: To be discovered
- **Lab 5**: To be discovered
- **Lab 6**: To be discovered

## To-Do List

- [ ] Implement OAuth2 integration for third-party authentication
- [ ] Add rate limiting and API throttling
- [ ] Implement comprehensive unit and integration tests
- [ ] Add API versioning support
- [ ] Implement caching layer for improved performance
- [ ] Add real-time notifications for enrollment updates
- [ ] Enhance error handling and validation
- [ ] Add API analytics and monitoring dashboard

## Contributing

This is a course project for learning purposes. Contributions are welcome for educational enhancement. Please follow the course guidelines and submit pull requests for review.

## License

This project is for educational purposes as part of the Web Service Software Engineering course.

## Contact

For questions or suggestions related to this course project, please contact the course instructor or teaching assistant.

[![Static Badge](https://img.shields.io/badge/course-WSSE-blue)](mailto:course@example.com)