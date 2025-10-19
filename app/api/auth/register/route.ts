import { type NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
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
    const { name, email, password } = await request.json()

    if (!name || !email || !password) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 })
    }

    const connection = await mysql.createConnection(dbConfig)

    try {
      // Check if user already exists
      const [existingUsers] = await connection.execute("SELECT id FROM users WHERE email = ?", [email])

      if ((existingUsers as any[]).length > 0) {
        return NextResponse.json({ message: "User already exists" }, { status: 400 })
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10)

      // Insert user
      const [result] = await connection.execute("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)", [
        name,
        email,
        hashedPassword,
        "user",
      ])

      const userId = (result as any).insertId

      // Create JWT token
      const token = jwt.sign({ userId, email, role: "user" }, process.env.JWT_SECRET || "your-secret-key", {
        expiresIn: "7d",
      })

      // Log activity
      await connection.execute("INSERT INTO activity_logs (user_id, activity_type, description) VALUES (?, ?, ?)", [
        userId,
        "registration",
        "User registered successfully",
      ])

      return NextResponse.json({
        message: "User registered successfully",
        token,
        user: {
          id: userId,
          name,
          email,
          role: "user",
        },
      })
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
