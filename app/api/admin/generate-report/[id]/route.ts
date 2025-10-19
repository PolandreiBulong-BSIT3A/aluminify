/**
 * ALUMIFY GRADUATE TRACER STUDY SYSTEM
 * Alumni Data Export Module
 * 
 * Purpose: Generates formal CSV reports of alumni data for administrative use
 * Access: Restricted to admin users only
 * 
 * Last Updated: [Current Date]
 * Developed by: [Your Department/Team Name]
 */

import { type NextRequest, NextResponse } from "next/server"
import jwt from "jsonwebtoken"
import mysql from "mysql2/promise"

// Database Configuration
const databaseConfiguration = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "alumify",
}

export async function GET(
  request: NextRequest, 
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication Verification
    const authorizationHeader = request.headers.get("authorization")
    if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { message: "Authorization required: No valid token provided" },
        { status: 401 }
      )
    }

    // 2. Token Validation
    const accessToken = authorizationHeader.substring(7)
    const decodedToken = jwt.verify(
      accessToken, 
      process.env.JWT_SECRET || "your-secret-key"
    ) as any

    if (decodedToken.role !== "admin") {
      return NextResponse.json(
        { message: "Access forbidden: Administrator privileges required" },
        { status: 403 }
      )
    }

    // 3. Data Retrieval
    const alumniId = params.id
    const databaseConnection = await mysql.createConnection(databaseConfiguration)

    try {
      const [alumniData] = await databaseConnection.execute(
        `SELECT 
          u.id,
          u.name,
          u.email,
          u.created_at,
          gp.mobile_number,
          gp.civil_status,
          gp.sex,
          gp.permanent_address,
          gp.telephone,
          gp.birthday,
          gp.region_of_origin,
          gp.province,
          gp.location_type,
          eb.degree,
          eb.specialization,
          eb.college_university,
          eb.year_graduated,
          eb.honors_awards,
          ed.is_employed,
          ed.employment_status,
          ed.present_occupation,
          ed.business_line,
          ed.place_of_work,
          ed.job_level_current,
          ed.initial_gross_monthly_earning,
          ed.curriculum_relevant,
          sr.is_completed as survey_completed,
          sr.completed_at as survey_completed_at
        FROM users u
        LEFT JOIN graduate_profiles gp ON u.id = gp.user_id
        LEFT JOIN educational_background eb ON u.id = eb.user_id
        LEFT JOIN employment_data ed ON u.id = ed.user_id
        LEFT JOIN survey_responses sr ON u.id = sr.user_id
        WHERE u.id = ? AND u.role = 'user'`,
        [alumniId]
      )

      if ((alumniData as any[]).length === 0) {
        return NextResponse.json(
          { message: "Data not found: Specified alumni record does not exist" },
          { status: 404 }
        )
      }

      const alumniRecord = (alumniData as any[])[0]

      // 4. Report Generation
      const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      const csvReport = [
        // Report Header
        "ALUMIFY - OFFICIAL REPORT",
        `Report Generated: ${currentDate}`,
        
        "",
        
        // Section 1: Personal Information
        "PERSONAL INFORMATION",
        
        `Full Name: ${alumniRecord.name}`,
        `Email Address: ${alumniRecord.email}`,
        `Contact Number: ${alumniRecord.mobile_number || "Not Provided"}`,
        `Civil Status: ${alumniRecord.civil_status || "Not Provided"}`,
        `Gender: ${alumniRecord.sex || "Not Provided"}`,
        `Permanent Address: ${alumniRecord.permanent_address || "Not Provided"}`,
        "",
        
        // Section 2: Educational Background
        "EDUCATIONAL BACKGROUND",
        
        `Degree Obtained: ${alumniRecord.degree || "Not Provided"}`,
        `Specialization: ${alumniRecord.specialization || "Not Provided"}`,
        `Institution: ${alumniRecord.college_university || "Not Provided"}`,
        `Year of Graduation: ${alumniRecord.year_graduated || "Not Provided"}`,
        `Honors/Awards: ${alumniRecord.honors_awards || "None"}`,
        "",
        
        // Section 3: Employment Information
        "EMPLOYMENT STATUS",
        
        `Currently Employed: ${alumniRecord.is_employed ? "Yes" : "No"}`,
        `Employment Status: ${alumniRecord.employment_status || "Not Provided"}`,
        `Current Occupation: ${alumniRecord.present_occupation || "Not Provided"}`,
        `Industry: ${alumniRecord.business_line || "Not Provided"}`,
        `Place of Work: ${alumniRecord.place_of_work || "Not Provided"}`,
        `Job Level: ${alumniRecord.job_level_current || "Not Provided"}`,
        `Monthly Earnings: ${alumniRecord.initial_gross_monthly_earning || "Not Provided"}`,
        `Curriculum Relevance: ${alumniRecord.curriculum_relevant || "Not Provided"}`,
        "",
        
        // Section 4: Survey Completion
        "SURVEY PARTICIPATION",
        
        `Survey Completed: ${alumniRecord.survey_completed ? "Yes" : "No"}`,
        `Completion Date: ${
          alumniRecord.survey_completed_at 
            ? new Date(alumniRecord.survey_completed_at).toLocaleDateString() 
            : "N/A"
        }`,
        "",
        
        // Footer
        "END OF REPORT",
        "This document is system-generated by the Alumify Graduate Tracer Study System",
        "For verification or concerns, please contact Alumify@gmail.com"
      ].join("\n")

      // 5. Report Delivery
      const formattedName = alumniRecord.name.replace(/\s+/g, "_")
      const reportFilename = `Alumify_Report_${formattedName}_${Date.now()}.csv`

      return new NextResponse(csvReport, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="${reportFilename}"`,
        },
      })
    } finally {
      await databaseConnection.end()
    }
  } catch (error) {
    console.error("Report Generation Error:", error)
    return NextResponse.json(
      { 
        message: "System Error: Failed to generate report. Please contact technical support." 
      },
      { status: 500 }
    )
  }
}