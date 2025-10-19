import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

// Database connection configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'alumify',
  port: parseInt(process.env.DB_PORT || '3306'),
};

async function getDatabaseConnection() {
  return await mysql.createConnection(dbConfig);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { alumniId: string } }
) {
  let connection;
  
  try {
    const alumniId = parseInt(params.alumniId);
    
    if (isNaN(alumniId)) {
      return NextResponse.json(
        { message: 'Invalid alumni ID' },
        { status: 400 }
      );
    }

    connection = await getDatabaseConnection();

    // Fetch user data
    const [userRows]: any = await connection.execute(
      'SELECT id, name, email, created_at, updated_at FROM users WHERE id = ?',
      [alumniId]
    );

    if (!userRows || userRows.length === 0) {
      return NextResponse.json(
        { message: 'Alumni not found' },
        { status: 404 }
      );
    }

    const userData = userRows[0];

    // Fetch all related data in parallel
    const [
      graduateProfileRows,
      educationalBackgroundRows,
      employmentDataRows,
      courseReasonsRows,
      unemploymentReasonsRows,
      usefulCompetenciesRows,
      curriculumSuggestionsRows,
      surveyResponseRows
    ] = await Promise.all([
      // Graduate profile
      connection.execute('SELECT * FROM graduate_profiles WHERE user_id = ?', [alumniId]),
      
      // Educational background
      connection.execute('SELECT * FROM educational_background WHERE user_id = ?', [alumniId]),
      
      // Employment data
      connection.execute('SELECT * FROM employment_data WHERE user_id = ?', [alumniId]),
      
      // Course reasons
      connection.execute('SELECT reason_type FROM course_reasons WHERE user_id = ?', [alumniId]),
      
      // Unemployment reasons
      connection.execute('SELECT reason FROM unemployment_reasons WHERE user_id = ?', [alumniId]),
      
      // Useful competencies
      connection.execute('SELECT competency FROM useful_competencies WHERE user_id = ?', [alumniId]),
      
      // Curriculum suggestions
      connection.execute('SELECT suggestion FROM curriculum_suggestions WHERE user_id = ?', [alumniId]),
      
      // Survey response status
      connection.execute('SELECT * FROM survey_responses WHERE user_id = ?', [alumniId])
    ]);

    // Extract data from query results
    const graduateProfile = (graduateProfileRows as any[])[0]?.[0] || null;
    const educationalBackground = (educationalBackgroundRows as any[])[0]?.[0] || null;
    const employmentData = (employmentDataRows as any[])[0]?.[0] || null;
    const courseReasons = (courseReasonsRows as any[])[0]?.map((cr: any) => cr.reason_type) || [];
    const unemploymentReasons = (unemploymentReasonsRows as any[])[0]?.map((ur: any) => ur.reason) || [];
    const usefulCompetencies = (usefulCompetenciesRows as any[])[0]?.map((uc: any) => uc.competency) || [];
    const curriculumSuggestions = (curriculumSuggestionsRows as any[])[0]?.[0]?.suggestion || null;
    const surveyResponse = (surveyResponseRows as any[])[0]?.[0] || null;

    const surveyData = {
      user: userData,
      graduateProfile,
      educationalBackground,
      employmentData,
      courseReasons,
      unemploymentReasons,
      usefulCompetencies,
      curriculumSuggestions,
      surveyResponse
    };

    return NextResponse.json(surveyData);

  } catch (error) {
    console.error('Error fetching alumni survey:', error);
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}