# Lab 1 Submission

## Repository Link

[WSSE Student Enrollment Labs 2025](https://github.com/Unforgettableeternalproject/wsse-student-enrollment-labs-2025)

## Pull Request Link

[PR #1: Lab 1 Implementation](https://github.com/Unforgettableeternalproject/wsse-student-enrollment-labs-2025/pull/1)

## Screenshots

### Swagger Editor Screenshot

![Swagger Editor](images/lab01/01-editor.png)

### PR Green Light Screenshot

![PR Green Light](images/lab01/02-pr-green.png)

### CI Content Screenshot

![CI Content](images/lab01/03-actions-log.png)

## Key Snippets from openapi.yaml

### Health Check Endpoint

```yaml
paths:
  /health:
    get:
      summary: "Health Check"
      description: "Check the health status of the API"
      security: []  # No authentication required (currently)
      responses:
        '200':
          description: "API is healthy (OK)"
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    example: "ok"
```

### GET /students Endpoint

```yaml
  /students:
    get:
      summary: "List Students"
      tags: [health]
      description: "Retrieve a list of all students"
      responses:
        '200':
          description: "A list of students"
          content:
            application/json:
              schema:
                type: object
                properties:
                  items:
                    type: array
                    items:
                      $ref: '#/components/schemas/Student'
        '500':
          description: "Server error"
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

### POST /students Endpoint

```yaml
    post:
      summary: "Create Student"
      requestBody:
        description: "Student object that needs to be added"
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Student'
            examples:
              ok:
                value:
                  id: 101
                  name: "Bernie"
      responses:
        '201':
          description: "Student created successfully"
          headers:
            Location:
              description: "URL of the created student"
              schema:
                type: string
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Student'
        '400':
          description: "Invalid input"
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

### Schemas

#### Student Schema

```yaml
components:
  schemas:
    Student:
      type: object
      properties:
        id:
          type: integer
          format: int64
        name:
          type: string
          minLength: 1
      required:
        - id
        - name
```

#### Error Schema

```yaml
    Error:
      type: object
      properties:
        code:
          type: string
          example: "ERR_NOT_FOUND"
        message:
          type: string
      required:
        - code
        - message
```