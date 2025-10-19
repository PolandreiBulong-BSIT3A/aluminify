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
      // Overview statistics
      const [totalUsersResult] = await connection.execute('SELECT COUNT(*) as count FROM users WHERE role = "user"')
      const totalUsers = (totalUsersResult as any[])[0].count

      const [completedSurveysResult] = await connection.execute(
        "SELECT COUNT(*) as count FROM survey_responses WHERE is_completed = TRUE",
      )
      const completedSurveys = (completedSurveysResult as any[])[0].count

      // Employment status distribution
      const [employmentStatusResult] = await connection.execute(`
        SELECT 
          ed.is_employed as status,
          COUNT(*) as count
        FROM employment_data ed
        JOIN survey_responses sr ON ed.user_id = sr.user_id
        WHERE sr.is_completed = TRUE
        GROUP BY ed.is_employed
      `)

      const employmentStatus = employmentStatusResult as any[]
      const employedCount = employmentStatus.find((s) => s.status === "Yes")?.count || 0
      const employmentRate = completedSurveys > 0 ? ((employedCount / completedSurveys) * 100).toFixed(1) : 0
      const responseRate = totalUsers > 0 ? ((completedSurveys / totalUsers) * 100).toFixed(1) : 0

      // Job levels distribution
      const [jobLevelsResult] = await connection.execute(`
        SELECT 
          job_level_current as job_level,
          COUNT(*) as count
        FROM employment_data ed
        JOIN survey_responses sr ON ed.user_id = sr.user_id
        WHERE sr.is_completed = TRUE AND ed.is_employed = 'Yes' AND job_level_current IS NOT NULL
        GROUP BY job_level_current
      `)

      // Graduation years analysis
      const [graduationYearsResult] = await connection.execute(`
        SELECT 
          eb.year_graduated,
          COUNT(*) as total_graduates,
          SUM(CASE WHEN ed.is_employed = 'Yes' THEN 1 ELSE 0 END) as employed,
          ROUND((SUM(CASE WHEN ed.is_employed = 'Yes' THEN 1 ELSE 0 END) / COUNT(*)) * 100, 1) as employment_rate
        FROM educational_background eb
        JOIN survey_responses sr ON eb.user_id = sr.user_id
        LEFT JOIN employment_data ed ON eb.user_id = ed.user_id
        WHERE sr.is_completed = TRUE AND eb.year_graduated IS NOT NULL
        GROUP BY eb.year_graduated
        ORDER BY eb.year_graduated DESC
      `)

      // Degree programs analysis
      const [degreeProgramsResult] = await connection.execute(`
        SELECT 
          eb.degree,
          COUNT(*) as total,
          SUM(CASE WHEN ed.is_employed = 'Yes' THEN 1 ELSE 0 END) as employed,
          SUM(CASE WHEN ed.is_employed != 'Yes' THEN 1 ELSE 0 END) as unemployed
        FROM educational_background eb
        JOIN survey_responses sr ON eb.user_id = sr.user_id
        LEFT JOIN employment_data ed ON eb.user_id = ed.user_id
        WHERE sr.is_completed = TRUE AND eb.degree IS NOT NULL
        GROUP BY eb.degree
        ORDER BY total DESC
      `)

      // Top industries
      const [topIndustriesResult] = await connection.execute(`
        SELECT 
          business_line,
          COUNT(*) as count
        FROM employment_data ed
        JOIN survey_responses sr ON ed.user_id = sr.user_id
        WHERE sr.is_completed = TRUE AND ed.is_employed = 'Yes' AND business_line IS NOT NULL
        GROUP BY business_line
        ORDER BY count DESC
        LIMIT 10
      `)

      // Salary distribution
      const [salaryDistributionResult] = await connection.execute(`
        SELECT 
          initial_gross_monthly_earning as salary_range,
          COUNT(*) as count
        FROM employment_data ed
        JOIN survey_responses sr ON ed.user_id = sr.user_id
        WHERE sr.is_completed = TRUE AND ed.is_employed = 'Yes' AND initial_gross_monthly_earning IS NOT NULL
        GROUP BY initial_gross_monthly_earning
        ORDER BY count DESC
      `)

      // Trends over time (employment rate by graduation year)
      const trends = (graduationYearsResult as any[]).map((year) => ({
        year: year.year_graduated,
        employment_rate: Number.parseFloat(year.employment_rate),
      }))

      const analytics = {
        overview: {
          total_users: totalUsers,
          completed_surveys: completedSurveys,
          employment_rate: Number.parseFloat(employmentRate),
          response_rate: Number.parseFloat(responseRate),
        },
        employment_status: employmentStatus.map((status) => ({
          status: status.status === "Yes" ? "Employed" : status.status === "No" ? "Unemployed" : "Never Employed",
          count: status.count,
        })),
        job_levels: jobLevelsResult,
        graduation_years: graduationYearsResult,
        degree_programs: degreeProgramsResult,
        top_industries: topIndustriesResult,
        salary_distribution: salaryDistributionResult,
        trends: trends,
      }

      return NextResponse.json(analytics)
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Analytics error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
