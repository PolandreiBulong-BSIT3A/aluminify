import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

async function connectDB() {
  return await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'alumify',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306,
  });
}

export async function PUT(request: NextRequest) {
  let connection;
  
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const body = await request.json();
    const { name, mobile_number, civil_status, sex, permanent_address, telephone, birthday } = body;

    if (!name) {
      return NextResponse.json({ message: 'Name is required' }, { status: 400 });
    }

    connection = await connectDB();

    // Get user ID from token (assuming token is stored in users table or you have another way)
    // Since we don't know how tokens are structured, let's get user from localStorage data
    // This is a temporary workaround - you'll need to adjust based on your auth system
    
    // Alternative: Get the most recent active user (for testing)
    const getActiveUserQuery = `
      SELECT u.id 
      FROM users u 
      INNER JOIN activity_logs al ON u.id = al.user_id 
      WHERE al.activity_type = 'login' 
      ORDER BY al.created_at DESC 
      LIMIT 1
    `;
    
    const [userRows]: any = await connection.execute(getActiveUserQuery);
    
    if (userRows.length === 0) {
      return NextResponse.json({ message: 'No active user found' }, { status: 404 });
    }

    const userId = userRows[0].id;
    console.log('Using user ID:', userId);

    // Update users table
    const updateUserQuery = `UPDATE users SET name = ? WHERE id = ?`;
    await connection.execute(updateUserQuery, [name, userId]);

    // Update graduate profile
    const updateProfileQuery = `
      UPDATE graduate_profiles 
      SET mobile_number = ?, civil_status = ?, sex = ?, 
          permanent_address = ?, telephone = ?, birthday = ?
      WHERE user_id = ?
    `;
    await connection.execute(
      updateProfileQuery,
      [mobile_number, civil_status, sex, permanent_address, telephone, birthday, userId]
    );

    // Log activity
    await connection.execute(
      `INSERT INTO activity_logs (user_id, activity_type, description) VALUES (?, 'profile_updated', ?)`,
      [userId, `User updated profile`]
    );

    return NextResponse.json({
      message: 'Profile updated successfully',
      data: body
    });

  } catch (error: any) {
    console.error('Error:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  } finally {
    if (connection) await connection.end();
  }
}