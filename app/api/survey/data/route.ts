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

    const connection = await mysql.createConnection(dbConfig)

    try {
      // Get employment data
      const [employmentRows] = await connection.execute("SELECT * FROM employment_data WHERE user_id = ?", [
        decoded.userId,
      ])

      const employmentData = employmentRows[0] || {}

      return NextResponse.json(employmentData)
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Survey data fetch error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
