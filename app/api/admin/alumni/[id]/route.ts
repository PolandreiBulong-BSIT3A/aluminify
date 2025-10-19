import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import mysql from "mysql2/promise"

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "alumify",
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
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

    const alumniId = params.id
    const alumniData = await request.json()
    const connection = await mysql.createConnection(dbConfig)

    try {
      await connection.beginTransaction()

      // Update user basic info
      await connection.execute("UPDATE users SET name = ?, email = ? WHERE id = ?", [
        alumniData.name,
        alumniData.email,
        alumniId,
      ])

      // Update or insert graduate profile
      const [existingProfile] = (await connection.execute("SELECT id FROM graduate_profiles WHERE user_id = ?", [
        alumniId,
      ])) as any

      if (existingProfile.length > 0) {
        await connection.execute(
          `UPDATE graduate_profiles SET 
           mobile_number = ?, 
           civil_status = ?, 
           sex = ?, 
           permanent_address = ?
           WHERE user_id = ?`,
          [
            alumniData.mobile_number || "",
            alumniData.civil_status || "",
            alumniData.sex || "",
            alumniData.permanent_address || "",
            alumniId,
          ],
        )
      } else {
        await connection.execute(
          `INSERT INTO graduate_profiles (user_id, mobile_number, civil_status, sex, permanent_address)
           VALUES (?, ?, ?, ?, ?)`,
          [
            alumniId,
            alumniData.mobile_number || "",
            alumniData.civil_status || "",
            alumniData.sex || "",
            alumniData.permanent_address || "",
          ],
        )
      }

      // Update or insert educational background
      const [existingEducation] = (await connection.execute("SELECT id FROM educational_background WHERE user_id = ?", [
        alumniId,
      ])) as any

      if (existingEducation.length > 0) {
        await connection.execute(
          `UPDATE educational_background SET 
           degree = ?, 
           specialization = ?, 
           college_university = ?,
           year_graduated = ?,
           honors_awards = ?
           WHERE user_id = ?`,
          [
            alumniData.degree || "",
            alumniData.specialization || "",
            alumniData.college_university || "",
            alumniData.year_graduated || null,
            alumniData.honors_awards || "",
            alumniId,
          ],
        )
      } else {
        await connection.execute(
          `INSERT INTO educational_background (user_id, degree, specialization, college_university, year_graduated, honors_awards)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            alumniId,
            alumniData.degree || "",
            alumniData.specialization || "",
            alumniData.college_university || "",
            alumniData.year_graduated || null,
            alumniData.honors_awards || "",
          ],
        )
      }

      // Update or insert employment data
      const [existingEmployment] = (await connection.execute("SELECT id FROM employment_data WHERE user_id = ?", [
        alumniId,
      ])) as any

      if (existingEmployment.length > 0) {
        await connection.execute(
          `UPDATE employment_data SET 
           is_employed = ?, 
           present_occupation = ?, 
           business_line = ?,
           place_of_work = ?,
           job_level_current = ?
           WHERE user_id = ?`,
          [
            alumniData.is_employed || "",
            alumniData.present_occupation || "",
            alumniData.business_line || "",
            alumniData.place_of_work || "",
            alumniData.job_level_current || "",
            alumniId,
          ],
        )
      } else {
        await connection.execute(
          `INSERT INTO employment_data (user_id, is_employed, present_occupation, business_line, place_of_work, job_level_current)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            alumniId,
            alumniData.is_employed || "",
            alumniData.present_occupation || "",
            alumniData.business_line || "",
            alumniData.place_of_work || "",
            alumniData.job_level_current || "",
          ],
        )
      }

      // Get user name for activity log
      const [userResult] = (await connection.execute("SELECT name FROM users WHERE id = ?", [alumniId])) as any

      const userName = userResult[0]?.name || "Unknown User"

      // Log activity
      await connection.execute("INSERT INTO user_activities (user_id, activity_type, description) VALUES (?, ?, ?)", [
        decoded.userId,
        "profile_updated",
        `Admin updated profile for ${userName}`,
      ])

      await connection.commit()

      return NextResponse.json({
        message: "Alumni profile updated successfully",
        success: true,
      })
    } catch (error) {
      await connection.rollback()
      console.error("Database error during alumni update:", error)
      throw error
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Alumni update error:", error)
    return NextResponse.json(
      {
        message: "Failed to update alumni profile",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any;

    if (decoded.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const alumniId = params.id;
    const connection = await mysql.createConnection(dbConfig);

    try {
      await connection.beginTransaction();

      // Get user name before deletion for activity log
      const [userResult] = (await connection.execute("SELECT name FROM users WHERE id = ?", [alumniId])) as any;
      const userName = userResult[0]?.name || "Unknown User";

      // Delete related records first (foreign key constraints)
      // Changed from user_activities to activity_logs
      await connection.execute("DELETE FROM activity_logs WHERE user_id = ?", [alumniId]);
      await connection.execute("DELETE FROM survey_responses WHERE user_id = ?", [alumniId]);
      await connection.execute("DELETE FROM employment_data WHERE user_id = ?", [alumniId]);
      await connection.execute("DELETE FROM educational_background WHERE user_id = ?", [alumniId]);
      await connection.execute("DELETE FROM graduate_profiles WHERE user_id = ?", [alumniId]);
      
      // Remove this line - privacy_agreements table doesn't exist in your schema
      // await connection.execute("DELETE FROM privacy_agreements WHERE user_id = ?", [alumniId]);

      // Delete user
      const [deleteResult] = (await connection.execute("DELETE FROM users WHERE id = ? AND role = 'user'", [
        alumniId,
      ])) as any;

      if (deleteResult.affectedRows === 0) {
        await connection.rollback();
        return NextResponse.json({ message: "Alumni not found or cannot be deleted" }, { status: 404 });
      }

      // Log activity - changed to use activity_logs
      await connection.execute(
        "INSERT INTO activity_logs (user_id, activity_type, description) VALUES (?, ?, ?)", 
        [
          decoded.userId,
          "profile_deleted",
          `Admin deleted profile for ${userName}`,
        ]
      );

      await connection.commit();

      return NextResponse.json({
        message: "Alumni profile deleted successfully",
        success: true,
      });
    } catch (error) {
      await connection.rollback();
      console.error("Database error during alumni deletion:", error);
      throw error;
    } finally {
      await connection.end();
    }
  } catch (error) {
    console.error("Alumni delete error:", error);
    return NextResponse.json(
      {
        message: "Failed to delete alumni profile",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

