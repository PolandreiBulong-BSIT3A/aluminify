import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import mysql from "mysql2/promise"

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "alumify",
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any

    if (decoded.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const connection = await mysql.createConnection(dbConfig)

    try {
      const [alumniResult] = await connection.execute(`
        SELECT DISTINCT
          u.id,
          u.name,
          u.email,
          u.created_at,
          COALESCE(gp.mobile_number, '') as mobile_number,
          COALESCE(gp.civil_status, '') as civil_status,
          COALESCE(gp.sex, '') as sex,
          COALESCE(gp.permanent_address, '') as permanent_address,
          COALESCE(eb.degree, '') as degree,
          COALESCE(eb.specialization, '') as specialization,
          COALESCE(eb.college_university, '') as college_university,
          COALESCE(eb.year_graduated, '') as year_graduated,
          COALESCE(eb.honors_awards, '') as honors_awards,
          COALESCE(ed.is_employed, '') as is_employed,
          COALESCE(ed.present_occupation, '') as present_occupation,
          COALESCE(ed.business_line, '') as business_line,
          COALESCE(ed.place_of_work, '') as place_of_work,
          COALESCE(ed.job_level_current, '') as job_level_current,
          COALESCE(sr.is_completed, 0) as survey_completed,
          sr.completed_at as survey_completed_at
        FROM users u
        LEFT JOIN graduate_profiles gp ON u.id = gp.user_id
        LEFT JOIN educational_background eb ON u.id = eb.user_id
        LEFT JOIN employment_data ed ON u.id = ed.user_id
        LEFT JOIN survey_responses sr ON u.id = sr.user_id
        WHERE u.role = 'user'
        ORDER BY u.created_at DESC
      `)

      return NextResponse.json(alumniResult)
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Alumni fetch error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
