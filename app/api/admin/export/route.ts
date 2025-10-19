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
        SELECT 
          u.id,
          u.name,
          u.email,
          u.created_at as registration_date,
          COALESCE(gp.mobile_number, '') as mobile_number,
          COALESCE(gp.civil_status, '') as civil_status,
          COALESCE(gp.sex, '') as sex,
          COALESCE(gp.permanent_address, '') as permanent_address,
          COALESCE(gp.region_of_origin, '') as region,
          COALESCE(gp.province, '') as province,
          COALESCE(eb.degree, '') as degree,
          COALESCE(eb.specialization, '') as specialization,
          COALESCE(eb.college_university, '') as university,
          COALESCE(eb.year_graduated, '') as year_graduated,
          COALESCE(eb.honors_awards, '') as honors,
          COALESCE(ed.is_employed, '') as employment_status,
          COALESCE(ed.present_occupation, '') as occupation,
          COALESCE(ed.business_line, '') as business_line,
          COALESCE(ed.place_of_work, '') as work_location,
          COALESCE(ed.job_level_current, '') as job_level,
          COALESCE(ed.initial_gross_monthly_earning, '') as salary,
          COALESCE(ed.curriculum_relevant, '') as curriculum_relevance,
          COALESCE(sr.is_completed, 0) as survey_completed,
          COALESCE(sr.completed_at, '') as survey_completion_date
        FROM users u
        LEFT JOIN graduate_profiles gp ON u.id = gp.user_id
        LEFT JOIN educational_background eb ON u.id = eb.user_id
        LEFT JOIN employment_data ed ON u.id = ed.user_id
        LEFT JOIN survey_responses sr ON u.id = sr.user_id
        WHERE u.role = 'user'
        ORDER BY u.created_at DESC
      `)

      // Generate CSV content
      const csvHeader = [
        "ALUMIFY - COMPLETE ALUMNI DATABASE EXPORT",
        `Generated on: ${new Date().toLocaleDateString()}`,
        `Total Records: ${(alumniResult as any[]).length}`,
        "",
        "ID,Name,Email,Registration Date,Mobile,Civil Status,Sex,Address,Region,Province,Degree,Specialization,University,Year Graduated,Honors,Employment Status,Occupation,Business Line,Work Location,Job Level,Salary,Curriculum Relevance,Survey Completed,Survey Completion Date",
      ]

      const csvRows = (alumniResult as any[]).map((alumni) => {
        return [
          alumni.id,
          `"${alumni.name}"`,
          `"${alumni.email}"`,
          `"${new Date(alumni.registration_date).toLocaleDateString()}"`,
          `"${alumni.mobile_number}"`,
          `"${alumni.civil_status}"`,
          `"${alumni.sex}"`,
          `"${alumni.permanent_address}"`,
          `"${alumni.region}"`,
          `"${alumni.province}"`,
          `"${alumni.degree}"`,
          `"${alumni.specialization}"`,
          `"${alumni.university}"`,
          `"${alumni.year_graduated}"`,
          `"${alumni.honors}"`,
          `"${alumni.employment_status}"`,
          `"${alumni.occupation}"`,
          `"${alumni.business_line}"`,
          `"${alumni.work_location}"`,
          `"${alumni.job_level}"`,
          `"${alumni.salary}"`,
          `"${alumni.curriculum_relevance}"`,
          `"${alumni.survey_completed ? "Yes" : "No"}"`,
          `"${alumni.survey_completion_date ? new Date(alumni.survey_completion_date).toLocaleDateString() : "N/A"}"`,
        ].join(",")
      })

      const csvContent = [...csvHeader, ...csvRows].join("\n")

      // Log export activity
      await connection.execute("INSERT INTO activity_logs (user_id, activity_type, description) VALUES (?, ?, ?)", [
        decoded.userId,
        "profile_updated",
        "Admin exported all alumni data",
      ])

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="alumify_complete_export_${Date.now()}.csv"`,
        },
      })
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Export data error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
