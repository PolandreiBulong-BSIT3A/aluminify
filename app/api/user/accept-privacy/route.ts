import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import mysql from "mysql2/promise"

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "alumify",
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any

    const connection = await mysql.createConnection(dbConfig)

    try {
      await connection.execute("UPDATE users SET privacy_accepted = TRUE, privacy_accepted_at = NOW() WHERE id = ?", [
        decoded.userId,
      ])

      // Log activity
      await connection.execute("INSERT INTO activity_logs (user_id, activity_type, description) VALUES (?, ?, ?)", [
        decoded.userId,
        "profile_updated",
        "User accepted privacy agreement",
      ])

      return NextResponse.json({
        message: "Privacy agreement accepted successfully",
      })
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Accept privacy error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
