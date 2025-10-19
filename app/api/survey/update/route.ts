import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import mysql from "mysql2/promise"

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "alumify",
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any
    const userId = decoded.userId

    const updateData = await request.json()

    const connection = await mysql.createConnection(dbConfig)

    try {
      await connection.beginTransaction()

      // Update employment data
      await connection.execute(
        `UPDATE employment_data SET
          is_employed = ?,
          employment_status = ?,
          present_occupation = ?,
          business_line = ?,
          place_of_work = ?,
          updated_at = NOW()
        WHERE user_id = ?`,
        [
          updateData.is_employed,
          updateData.employment_status,
          updateData.present_occupation,
          updateData.business_line,
          updateData.place_of_work,
          userId,
        ],
      )

      // Log activity
      await connection.execute("INSERT INTO activity_logs (user_id, activity_type, description) VALUES (?, ?, ?)", [
        userId,
        "survey_updated",
        "User updated employment status",
      ])

      await connection.commit()

      return NextResponse.json({
        message: "Employment status updated successfully",
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Survey update error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
