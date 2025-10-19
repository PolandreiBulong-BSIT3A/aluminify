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
      const [activitiesResult] = await connection.execute(`
        SELECT 
          al.id,
          al.activity_type,
          al.description,
          al.created_at,
          u.name as user_name
        FROM activity_logs al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 50
      `)

      return NextResponse.json(activitiesResult)
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Recent activities error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
