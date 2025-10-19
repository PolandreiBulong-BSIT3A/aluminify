import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import mysql from "mysql2/promise"
import bcrypt from "bcryptjs"

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

    const { currentPassword, newPassword } = await request.json()

    const connection = await mysql.createConnection(dbConfig)

    try {
      // Get current password
      const [userRows] = await connection.execute("SELECT password FROM users WHERE id = ?", [decoded.userId])

      if ((userRows as any[]).length === 0) {
        return NextResponse.json({ message: "User not found" }, { status: 404 })
      }

      const user = (userRows as any[])[0]

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password)
      if (!isValidPassword) {
        return NextResponse.json({ message: "Current password is incorrect" }, { status: 400 })
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 10)

      // Update password
      await connection.execute("UPDATE users SET password = ? WHERE id = ?", [hashedNewPassword, decoded.userId])

      // Log activity
      await connection.execute("INSERT INTO activity_logs (user_id, activity_type, description) VALUES (?, ?, ?)", [
        decoded.userId,
        "password_changed",
        "User changed password",
      ])

      return NextResponse.json({
        message: "Password changed successfully",
      })
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Password change error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
