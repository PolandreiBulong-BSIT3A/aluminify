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
    const userId = decoded.userId

    const formData = await request.json()

    const connection = await mysql.createConnection(dbConfig)

    try {
      await connection.beginTransaction()

      // Update or insert graduate profile
      await connection.execute(
        `INSERT INTO graduate_profiles (
          user_id, permanent_address, telephone, mobile_number, civil_status, 
          sex, birthday, region_of_origin, province, location_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          permanent_address = VALUES(permanent_address),
          telephone = VALUES(telephone),
          mobile_number = VALUES(mobile_number),
          civil_status = VALUES(civil_status),
          sex = VALUES(sex),
          birthday = VALUES(birthday),
          region_of_origin = VALUES(region_of_origin),
          province = VALUES(province),
          location_type = VALUES(location_type)`,
        [
          userId,
          formData.permanent_address || null,
          formData.telephone || null,
          formData.mobile_number || null,
          formData.civil_status || null,
          formData.sex || null,
          formData.birthday || null,
          formData.region_of_origin || null,
          formData.province || null,
          formData.location_type || null,
        ],
      )

      // Insert educational background
      if (formData.degree || formData.specialization) {
        await connection.execute(
          `INSERT INTO educational_background (
            user_id, degree, specialization, college_university, year_graduated, honors_awards
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            degree = VALUES(degree),
            specialization = VALUES(specialization),
            college_university = VALUES(college_university),
            year_graduated = VALUES(year_graduated),
            honors_awards = VALUES(honors_awards)`,
          [
            userId,
            formData.degree || null,
            formData.specialization || null,
            formData.college_university || null,
            formData.year_graduated || null,
            formData.honors_awards || null,
          ],
        )
      }

      // Insert employment data
      await connection.execute(
        `INSERT INTO employment_data (
          user_id, is_employed, employment_status, present_occupation, business_line,
          place_of_work, is_first_job, job_level_first, job_level_current,
          initial_gross_monthly_earning, curriculum_relevant
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          is_employed = VALUES(is_employed),
          employment_status = VALUES(employment_status),
          present_occupation = VALUES(present_occupation),
          business_line = VALUES(business_line),
          place_of_work = VALUES(place_of_work),
          is_first_job = VALUES(is_first_job),
          job_level_first = VALUES(job_level_first),
          job_level_current = VALUES(job_level_current),
          initial_gross_monthly_earning = VALUES(initial_gross_monthly_earning),
          curriculum_relevant = VALUES(curriculum_relevant)`,
        [
          userId,
          formData.is_employed || null,
          formData.employment_status || null,
          formData.present_occupation || null,
          formData.business_line || null,
          formData.place_of_work || null,
          formData.is_first_job || null,
          formData.job_level_first || null,
          formData.job_level_current || null,
          formData.initial_gross_monthly_earning || null,
          formData.curriculum_relevant || null,
        ],
      )

      // Insert course reasons
      if (formData.course_reasons && formData.course_reasons.length > 0) {
        await connection.execute("DELETE FROM course_reasons WHERE user_id = ?", [userId])
        for (const reason of formData.course_reasons) {
          await connection.execute("INSERT INTO course_reasons (user_id, reason_type, level) VALUES (?, ?, ?)", [
            userId,
            reason,
            "Undergraduate",
          ])
        }
      }

      // Insert unemployment reasons
      if (formData.unemployment_reasons && formData.unemployment_reasons.length > 0) {
        await connection.execute("DELETE FROM unemployment_reasons WHERE user_id = ?", [userId])
        for (const reason of formData.unemployment_reasons) {
          await connection.execute("INSERT INTO unemployment_reasons (user_id, reason) VALUES (?, ?)", [userId, reason])
        }
      }

      // Insert useful competencies
      if (formData.useful_competencies && formData.useful_competencies.length > 0) {
        await connection.execute("DELETE FROM useful_competencies WHERE user_id = ?", [userId])
        for (const competency of formData.useful_competencies) {
          await connection.execute("INSERT INTO useful_competencies (user_id, competency) VALUES (?, ?)", [
            userId,
            competency,
          ])
        }
      }

      // Insert curriculum suggestions
      if (formData.curriculum_suggestions) {
        await connection.execute(
          `INSERT INTO curriculum_suggestions (user_id, suggestion) VALUES (?, ?)
          ON DUPLICATE KEY UPDATE suggestion = VALUES(suggestion)`,
          [userId, formData.curriculum_suggestions],
        )
      }

      // Mark survey as completed
      await connection.execute(
        `INSERT INTO survey_responses (user_id, is_completed, completed_at) 
        VALUES (?, TRUE, NOW())
        ON DUPLICATE KEY UPDATE 
          is_completed = TRUE, 
          completed_at = NOW()`,
        [userId],
      )

      // Log activity
      await connection.execute("INSERT INTO activity_logs (user_id, activity_type, description) VALUES (?, ?, ?)", [
        userId,
        "survey_completed",
        "User completed the graduate tracer survey",
      ])

      await connection.commit()

      return NextResponse.json({
        message: "Survey submitted successfully",
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      await connection.end()
    }
  } catch (error) {
    console.error("Survey submission error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
