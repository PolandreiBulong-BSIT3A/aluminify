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

    if (decoded.role !== "user") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const userId = decoded.userId
    const connection = await mysql.createConnection(dbConfig)

    try {
      const [rows] = await connection.execute(
        `SELECT
          u.id, u.name, u.email, u.created_at,
          gp.permanent_address, gp.telephone, gp.mobile_number, gp.civil_status, gp.sex, gp.birthday, gp.region_of_origin, gp.province, gp.location_type,
          eb.degree, eb.specialization, eb.college_university, eb.year_graduated, eb.honors_awards,
          ed.is_employed, ed.employment_status, ed.present_occupation, ed.business_line, ed.place_of_work, ed.is_first_job, ed.job_level_first, ed.job_level_current, ed.initial_gross_monthly_earning, ed.curriculum_relevant,
          sr.is_completed AS survey_completed, sr.completed_at AS survey_completed_at,
          GROUP_CONCAT(DISTINCT cr.reason_type) AS course_reasons,
          GROUP_CONCAT(DISTINCT ur.reason) AS unemployment_reasons,
          GROUP_CONCAT(DISTINCT uc.competency) AS useful_competencies,
          cs.suggestion AS curriculum_suggestions
        FROM users u
        LEFT JOIN graduate_profiles gp ON u.id = gp.user_id
        LEFT JOIN educational_background eb ON u.id = eb.user_id
        LEFT JOIN employment_data ed ON u.id = ed.user_id
        LEFT JOIN survey_responses sr ON u.id = sr.user_id
        LEFT JOIN course_reasons cr ON u.id = cr.user_id
        LEFT JOIN unemployment_reasons ur ON u.id = ur.user_id
        LEFT JOIN useful_competencies uc ON u.id = uc.user_id
        LEFT JOIN curriculum_suggestions cs ON u.id = cs.user_id
        WHERE u.id = ? AND u.role = 'user'
        GROUP BY u.id`,
        [userId],
      )

      if (Array.isArray(rows) && rows.length > 0) {
        return NextResponse.json(rows[0])
      } else {
        return NextResponse.json({ message: "Profile not found" }, { status: 404 })
      }
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Profile fetch error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "your-secret-key") as any

    if (decoded.role !== "user") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 })
    }

    const userId = decoded.userId
    const profileData = await request.json()
    const connection = await mysql.createConnection(dbConfig)

    try {
      await connection.beginTransaction()

      // Update user basic info
      await connection.execute("UPDATE users SET name = ? WHERE id = ?", [profileData.name, userId])

      // Update or insert graduate profile
      const [existingProfile] = (await connection.execute("SELECT id FROM graduate_profiles WHERE user_id = ?", [
        userId,
      ])) as any

      if (existingProfile.length > 0) {
        await connection.execute(
          `UPDATE graduate_profiles SET
           permanent_address = ?, telephone = ?, mobile_number = ?, civil_status = ?,
           sex = ?, birthday = ?, region_of_origin = ?, province = ?, location_type = ?
           WHERE user_id = ?`,
          [
            profileData.permanent_address || null,
            profileData.telephone || null,
            profileData.mobile_number || null,
            profileData.civil_status || null,
            profileData.sex || null,
            profileData.birthday || null,
            profileData.region_of_origin || null,
            profileData.province || null,
            profileData.location_type || null,
            userId,
          ],
        )
      } else {
        await connection.execute(
          `INSERT INTO graduate_profiles (user_id, permanent_address, telephone, mobile_number, civil_status, sex, birthday, region_of_origin, province, location_type)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            profileData.permanent_address || null,
            profileData.telephone || null,
            profileData.mobile_number || null,
            profileData.civil_status || null,
            profileData.sex || null,
            profileData.birthday || null,
            profileData.region_of_origin || null,
            profileData.province || null,
            profileData.location_type || null,
          ],
        )
      }

      // Update or insert educational background
      const [existingEducation] = (await connection.execute("SELECT id FROM educational_background WHERE user_id = ?", [
        userId,
      ])) as any

      if (existingEducation.length > 0) {
        await connection.execute(
          `UPDATE educational_background SET
           degree = ?, specialization = ?, college_university = ?, year_graduated = ?, honors_awards = ?
           WHERE user_id = ?`,
          [
            profileData.degree || null,
            profileData.specialization || null,
            profileData.college_university || null,
            profileData.year_graduated || null,
            profileData.honors_awards || null,
            userId,
          ],
        )
      } else {
        await connection.execute(
          `INSERT INTO educational_background (user_id, degree, specialization, college_university, year_graduated, honors_awards)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            userId,
            profileData.degree || null,
            profileData.specialization || null,
            profileData.college_university || null,
            profileData.year_graduated || null,
            profileData.honors_awards || null,
          ],
        )
      }

      // Update or insert employment data
      const [existingEmployment] = (await connection.execute("SELECT id FROM employment_data WHERE user_id = ?", [
        userId,
      ])) as any

      if (existingEmployment.length > 0) {
        await connection.execute(
          `UPDATE employment_data SET
           is_employed = ?, employment_status = ?, present_occupation = ?, business_line = ?,
           place_of_work = ?, is_first_job = ?, job_level_first = ?, job_level_current = ?,
           initial_gross_monthly_earning = ?, curriculum_relevant = ?
           WHERE user_id = ?`,
          [
            profileData.is_employed || null,
            profileData.employment_status || null,
            profileData.present_occupation || null,
            profileData.business_line || null,
            profileData.place_of_work || null,
            profileData.is_first_job || null,
            profileData.job_level_first || null,
            profileData.job_level_current || null,
            profileData.initial_gross_monthly_earning || null,
            profileData.curriculum_relevant || null,
            userId,
          ],
        )
      } else {
        await connection.execute(
          `INSERT INTO employment_data (user_id, is_employed, employment_status, present_occupation, business_line, place_of_work, is_first_job, job_level_first, job_level_current, initial_gross_monthly_earning, curriculum_relevant)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            profileData.is_employed || null,
            profileData.employment_status || null,
            profileData.present_occupation || null,
            profileData.business_line || null,
            profileData.place_of_work || null,
            profileData.is_first_job || null,
            profileData.job_level_first || null,
            profileData.job_level_current || null,
            profileData.initial_gross_monthly_earning || null,
            profileData.curriculum_relevant || null,
          ],
        )
      }

      // Handle course reasons
      if (profileData.course_reasons && profileData.course_reasons.length > 0) {
        await connection.execute("DELETE FROM course_reasons WHERE user_id = ?", [userId])
        for (const reason of profileData.course_reasons) {
          await connection.execute("INSERT INTO course_reasons (user_id, reason_type, level) VALUES (?, ?, ?)", [
            userId,
            reason,
            "Undergraduate",
          ])
        }
      } else {
        await connection.execute("DELETE FROM course_reasons WHERE user_id = ?", [userId])
      }

      // Handle unemployment reasons
      if (profileData.unemployment_reasons && profileData.unemployment_reasons.length > 0) {
        await connection.execute("DELETE FROM unemployment_reasons WHERE user_id = ?", [userId])
        for (const reason of profileData.unemployment_reasons) {
          await connection.execute("INSERT INTO unemployment_reasons (user_id, reason) VALUES (?, ?)", [userId, reason])
        }
      } else {
        await connection.execute("DELETE FROM unemployment_reasons WHERE user_id = ?", [userId])
      }

      // Handle useful competencies
      if (profileData.useful_competencies && profileData.useful_competencies.length > 0) {
        await connection.execute("DELETE FROM useful_competencies WHERE user_id = ?", [userId])
        for (const competency of profileData.useful_competencies) {
          await connection.execute("INSERT INTO useful_competencies (user_id, competency) VALUES (?, ?)", [
            userId,
            competency,
          ])
        }
      } else {
        await connection.execute("DELETE FROM useful_competencies WHERE user_id = ?", [userId])
      }

      // Handle curriculum suggestions
      const [existingCurriculumSuggestion] = (await connection.execute(
        "SELECT id FROM curriculum_suggestions WHERE user_id = ?",
        [userId],
      )) as any

      if (profileData.curriculum_suggestions) {
        if (existingCurriculumSuggestion.length > 0) {
          await connection.execute(`UPDATE curriculum_suggestions SET suggestion = ? WHERE user_id = ?`, [
            profileData.curriculum_suggestions,
            userId,
          ])
        } else {
          await connection.execute(`INSERT INTO curriculum_suggestions (user_id, suggestion) VALUES (?, ?)`, [
            userId,
            profileData.curriculum_suggestions,
          ])
        }
      } else {
        await connection.execute("DELETE FROM curriculum_suggestions WHERE user_id = ?", [userId])
      }

      // Log activity
      const [userResult] = (await connection.execute("SELECT name FROM users WHERE id = ?", [userId])) as any
      const userName = userResult[0]?.name || "Unknown User"
      await connection.execute("INSERT INTO user_activities (user_id, activity_type, description) VALUES (?, ?, ?)", [
        userId,
        "profile_updated",
        `${userName} updated their profile`,
      ])

      await connection.commit()

      return NextResponse.json({ message: "Profile updated successfully", success: true })
    } catch (error) {
      await connection.rollback()
      console.error("Database error during profile update:", error)
      return NextResponse.json(
        {
          message: "Failed to update profile",
          error: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Profile update error:", error)
    return NextResponse.json(
      {
        message: "Failed to update profile",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
