// In-memory storage for students (will reset on Lambda cold start)
let students = [];
let nextId = 1;

export const handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  
  const { httpMethod, path } = event;
  
  try {
    // Health check endpoint
    if (path === '/health' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ status: 'ok' })
      };
    }
    
    // Get all students
    if (path === '/students' && httpMethod === 'GET') {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify(students)
      };
    }
    
    // Create a new student
    if (path === '/students' && httpMethod === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      // Validate request
      if (!body.name || typeof body.name !== 'string') {
        return {
          statusCode: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            code: 400,
            message: 'Invalid request: name is required and must be a string'
          })
        };
      }
      
      // Create new student
      const newStudent = {
        id: nextId++,
        name: body.name
      };
      
      students.push(newStudent);
      
      return {
        statusCode: 201,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Location': `/students/${newStudent.id}`
        },
        body: JSON.stringify(newStudent)
      };
    }
    
    // Path not found
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 404,
        message: 'Not Found'
      })
    };
    
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        code: 500,
        message: 'Internal Server Error'
      })
    };
  }
};
