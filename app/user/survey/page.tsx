"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, ArrowRight, Save } from "lucide-react"
import { useRouter } from "next/navigation"

export default function SurveyPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<any>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const router = useRouter()

  const totalSteps = 6

  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      router.push("/")
      return
    }

    // Check if survey is already completed
    checkSurveyStatus()
  }, [router])

  const checkSurveyStatus = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/survey/status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.is_completed) {
          router.push("/user/dashboard")
        }
      }
    } catch (error) {
      console.error("Error checking survey status:", error)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData({
      ...formData,
      [field]: value,
    })
    // Clear validation error when field is updated
    if (validationErrors[field]) {
      const newErrors = {...validationErrors}
      delete newErrors[field]
      setValidationErrors(newErrors)
    }
  }

  const handleCheckboxChange = (field: string, value: string, checked: boolean) => {
    const currentValues = formData[field] || []
    if (checked) {
      setFormData({
        ...formData,
        [field]: [...currentValues, value],
      })
    } else {
      setFormData({
        ...formData,
        [field]: currentValues.filter((item: string) => item !== value),
      })
    }
    // Clear validation error when checkbox is updated
    if (validationErrors[field]) {
      const newErrors = {...validationErrors}
      delete newErrors[field]
      setValidationErrors(newErrors)
    }
  }

  const validateStep = (step: number) => {
    const errors: Record<string, string> = {}

    if (step === 1) {
      if (!formData.name) errors.name = "Full name is required"
      if (!formData.email) errors.email = "Email address is required"
      if (!formData.permanent_address) errors.permanent_address = "Permanent address is required"
      if (!formData.mobile_number) errors.mobile_number = "Mobile number is required"
      if (!formData.civil_status) errors.civil_status = "Civil status is required"
      if (!formData.sex) errors.sex = "Sex is required"
      if (!formData.birthday) errors.birthday = "Birthday is required"
    }

    if (step === 2) {
      if (!formData.degree) errors.degree = "Degree is required"
      if (!formData.specialization) errors.specialization = "Specialization is required"
      if (!formData.college_university) errors.college_university = "College/University is required"
      if (!formData.year_graduated) errors.year_graduated = "Year graduated is required"
    }

    if (step === 3) {
      if (!formData.is_employed) errors.is_employed = "Employment status is required"
      
      if (formData.is_employed === "Yes") {
        if (!formData.employment_status) errors.employment_status = "Present employment status is required"
        if (!formData.present_occupation) errors.present_occupation = "Present occupation is required"
        if (!formData.business_line) errors.business_line = "Major line of business is required"
        if (!formData.place_of_work) errors.place_of_work = "Place of work is required"
      } else if (formData.is_employed === "No" || formData.is_employed === "Never Employed") {
        if (!formData.unemployment_reasons || formData.unemployment_reasons?.length === 0) {
          errors.unemployment_reasons = "Please select at least one reason for not being employed"
        }
      }
    }

    if (step === 4 && formData.is_employed === "Yes") {
      if (!formData.is_first_job) errors.is_first_job = "This field is required"
      if (!formData.job_level_first) errors.job_level_first = "Job level (first job) is required"
      if (!formData.job_level_current) errors.job_level_current = "Job level (current job) is required"
      if (!formData.initial_gross_monthly_earning) errors.initial_gross_monthly_earning = "Initial gross monthly earning is required"
      if (!formData.curriculum_relevant) errors.curriculum_relevant = "This field is required"
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      return
    }

    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) {
      return
    }

    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/survey/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        router.push("/user/dashboard")
      } else {
        const data = await response.json()
        setError(data.message || "Failed to submit survey")
      }
    } catch (error) {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">General Information</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={formData.name || ""}
                  onChange={(e) => handleInputChange("name", e.target.value)}
                  placeholder="Enter your full name"
                  className={validationErrors.name ? "border-red-500" : ""}
                />
                {validationErrors.name && <p className="text-red-500 text-sm mt-1">{validationErrors.name}</p>}
              </div>

              <div>
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ""}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  placeholder="Enter your email"
                  className={validationErrors.email ? "border-red-500" : ""}
                />
                {validationErrors.email && <p className="text-red-500 text-sm mt-1">{validationErrors.email}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="permanent_address">Permanent Address *</Label>
              <Textarea
                id="permanent_address"
                value={formData.permanent_address || ""}
                onChange={(e) => handleInputChange("permanent_address", e.target.value)}
                placeholder="Enter your permanent address"
                className={validationErrors.permanent_address ? "border-red-500" : ""}
              />
              {validationErrors.permanent_address && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.permanent_address}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="telephone">Telephone Number</Label>
                <Input
                  id="telephone"
                  value={formData.telephone || ""}
                  onChange={(e) => handleInputChange("telephone", e.target.value)}
                  placeholder="Enter telephone number"
                />
              </div>

              <div>
                <Label htmlFor="mobile_number">Mobile Number *</Label>
                <Input
                  id="mobile_number"
                  value={formData.mobile_number || ""}
                  onChange={(e) => handleInputChange("mobile_number", e.target.value)}
                  placeholder="Enter mobile number"
                  className={validationErrors.mobile_number ? "border-red-500" : ""}
                />
                {validationErrors.mobile_number && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.mobile_number}</p>
                )}
              </div>
            </div>

            <div>
              <Label>Civil Status *</Label>
              <RadioGroup
                value={formData.civil_status || ""}
                onValueChange={(value) => handleInputChange("civil_status", value)}
                className={validationErrors.civil_status ? "border-red-500 p-2 rounded-md border" : ""}
              >
                {["Single", "Married", "Separated", "Widow or Widower", "Single Parent"].map((status) => (
                  <div key={status} className="flex items-center space-x-2">
                    <RadioGroupItem value={status} id={status} />
                    <Label htmlFor={status}>{status}</Label>
                  </div>
                ))}
              </RadioGroup>
              {validationErrors.civil_status && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.civil_status}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label>Sex *</Label>
                <RadioGroup 
                  value={formData.sex || ""} 
                  onValueChange={(value) => handleInputChange("sex", value)}
                  className={validationErrors.sex ? "border-red-500 p-2 rounded-md border" : ""}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Male" id="male" />
                    <Label htmlFor="male">Male</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Female" id="female" />
                    <Label htmlFor="female">Female</Label>
                  </div>
                </RadioGroup>
                {validationErrors.sex && <p className="text-red-500 text-sm mt-1">{validationErrors.sex}</p>}
              </div>

              <div>
                <Label htmlFor="birthday">Birthday *</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={formData.birthday || ""}
                  onChange={(e) => handleInputChange("birthday", e.target.value)}
                  className={validationErrors.birthday ? "border-red-500" : ""}
                />
                {validationErrors.birthday && <p className="text-red-500 text-sm mt-1">{validationErrors.birthday}</p>}
              </div>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Educational Background</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="degree">Degree *</Label>
                <Input
                  id="degree"
                  value={formData.degree || ""}
                  onChange={(e) => handleInputChange("degree", e.target.value)}
                  placeholder="e.g., BSIT"
                  className={validationErrors.degree ? "border-red-500" : ""}
                />
                {validationErrors.degree && <p className="text-red-500 text-sm mt-1">{validationErrors.degree}</p>}
              </div>

              <div>
                <Label htmlFor="specialization">Specialization *</Label>
                <Input
                  id="specialization"
                  value={formData.specialization || ""}
                  onChange={(e) => handleInputChange("specialization", e.target.value)}
                  placeholder="e.g., Major in Web design"
                  className={validationErrors.specialization ? "border-red-500" : ""}
                />
                {validationErrors.specialization && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.specialization}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="college_university">College/University *</Label>
                <Input
                  id="college_university"
                  value={formData.college_university || ""}
                  onChange={(e) => handleInputChange("college_university", e.target.value)}
                  placeholder="Name of School"
                  className={validationErrors.college_university ? "border-red-500" : ""}
                />
                {validationErrors.college_university && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.college_university}</p>
                )}
              </div>

              <div>
                <Label htmlFor="year_graduated">Year Graduated *</Label>
                <Input
                  id="year_graduated"
                  type="number"
                  min="1950"
                  max="2030"
                  value={formData.year_graduated || ""}
                  onChange={(e) => handleInputChange("year_graduated", e.target.value)}
                  placeholder="YYYY"
                  className={validationErrors.year_graduated ? "border-red-500" : ""}
                />
                {validationErrors.year_graduated && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.year_graduated}</p>
                )}
              </div>
            </div>

            <div>
              <Label htmlFor="honors_awards">Honors/Awards Received</Label>
              <Textarea
                id="honors_awards"
                value={formData.honors_awards || ""}
                onChange={(e) => handleInputChange("honors_awards", e.target.value)}
                placeholder="List any honors or awards received"
              />
            </div>

            <div>
              <Label>Reasons for taking the course (check all that apply)</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {[
                  "High grades in the course or subject area(s) related to the course",
                  "Good grades in high school",
                  "Influence of parents or relatives",
                  "Peer Influence",
                  "Inspired by a role model",
                  "Strong passion for the profession",
                  "Prospect for immediate employment",
                  "Status or prestige of the profession",
                  "Availability of course offering in chosen institution",
                  "Prospect of career advancement",
                  "Affordable for the family",
                  "Prospect of attractive compensation",
                  "Opportunity for employment abroad",
                  "No particular choice or no better idea",
                ].map((reason) => (
                  <div key={reason} className="flex items-center space-x-2">
                    <Checkbox
                      id={reason}
                      checked={(formData.course_reasons || []).includes(reason)}
                      onCheckedChange={(checked) => handleCheckboxChange("course_reasons", reason, checked as boolean)}
                    />
                    <Label htmlFor={reason} className="text-sm">
                      {reason}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Employment Status</h2>

            <div>
              <Label>Are you presently employed? *</Label>
              <RadioGroup
                value={formData.is_employed || ""}
                onValueChange={(value) => handleInputChange("is_employed", value)}
                className={validationErrors.is_employed ? "border-red-500 p-2 rounded-md border" : ""}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Yes" id="employed_yes" />
                  <Label htmlFor="employed_yes">Yes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="No" id="employed_no" />
                  <Label htmlFor="employed_no">No</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="Never Employed" id="never_employed" />
                  <Label htmlFor="never_employed">Never Employed</Label>
                </div>
              </RadioGroup>
              {validationErrors.is_employed && (
                <p className="text-red-500 text-sm mt-1">{validationErrors.is_employed}</p>
              )}
            </div>

            {formData.is_employed === "No" || formData.is_employed === "Never Employed" ? (
              <div>
                <Label>Reasons for not being employed (check all that apply) *</Label>
                <div className={`grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 ${validationErrors.unemployment_reasons ? "border-red-500 p-2 rounded-md border" : ""}`}>
                  {[
                    "Advance or further study",
                    "Family concern and decided not to find a job",
                    "Health-related reason(s)",
                    "Lack of work experience",
                    "No job opportunity",
                    "Did not look for a job",
                  ].map((reason) => (
                    <div key={reason} className="flex items-center space-x-2">
                      <Checkbox
                        id={reason}
                        checked={(formData.unemployment_reasons || []).includes(reason)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange("unemployment_reasons", reason, checked as boolean)
                        }
                      />
                      <Label htmlFor={reason} className="text-sm">
                        {reason}
                      </Label>
                    </div>
                  ))}
                </div>
                {validationErrors.unemployment_reasons && (
                  <p className="text-red-500 text-sm mt-1">{validationErrors.unemployment_reasons}</p>
                )}
              </div>
            ) : formData.is_employed === "Yes" ? (
              <div className="space-y-4">
                <div>
                  <Label>Present Employment Status *</Label>
                  <RadioGroup
                    value={formData.employment_status || ""}
                    onValueChange={(value) => handleInputChange("employment_status", value)}
                    className={validationErrors.employment_status ? "border-red-500 p-2 rounded-md border" : ""}
                  >
                    {["Regular or Permanent", "Contractual", "Temporary", "Self-employed", "Casual"].map((status) => (
                      <div key={status} className="flex items-center space-x-2">
                        <RadioGroupItem value={status} id={status} />
                        <Label htmlFor={status}>{status}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {validationErrors.employment_status && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.employment_status}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="present_occupation">Present Occupation *</Label>
                  <Input
                    id="present_occupation"
                    value={formData.present_occupation || ""}
                    onChange={(e) => handleInputChange("present_occupation", e.target.value)}
                    placeholder="e.g., Software Engineer, Teacher"
                    className={validationErrors.present_occupation ? "border-red-500" : ""}
                  />
                  {validationErrors.present_occupation && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.present_occupation}</p>
                  )}
                </div>

                <div>
                  <Label>Major line of business of your company *</Label>
                  <RadioGroup
                    value={formData.business_line || ""}
                    onValueChange={(value) => handleInputChange("business_line", value)}
                    className={validationErrors.business_line ? "border-red-500 p-2 rounded-md border" : ""}
                  >
                    {[
                      "Agriculture, Hunting and Forestry",
                      "Fishing",
                      "Mining and Quarrying",
                      "Manufacturing",
                      "Electricity, Gas and Water Supply",
                      "Construction",
                      "Wholesale and Retail Trade",
                      "Hotels and Restaurants",
                      "Transport Storage and Communication",
                      "Financial Intermediation",
                      "Real Estate, Renting and Business Activities",
                      "Public Administration and Defense",
                      "Education",
                      "Health and Social Work",
                      "Other Community, Social and Personal Service Activities",
                    ].map((business) => (
                      <div key={business} className="flex items-center space-x-2">
                        <RadioGroupItem value={business} id={business} />
                        <Label htmlFor={business} className="text-sm">
                          {business}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {validationErrors.business_line && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.business_line}</p>
                  )}
                </div>

                <div>
                  <Label>Place of work *</Label>
                  <RadioGroup
                    value={formData.place_of_work || ""}
                    onValueChange={(value) => handleInputChange("place_of_work", value)}
                    className={validationErrors.place_of_work ? "border-red-500 p-2 rounded-md border" : ""}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Local" id="local" />
                      <Label htmlFor="local">Local</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Abroad" id="abroad" />
                      <Label htmlFor="abroad">Abroad</Label>
                    </div>
                  </RadioGroup>
                  {validationErrors.place_of_work && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.place_of_work}</p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Job Details</h2>

            {formData.is_employed === "Yes" && (
              <>
                <div>
                  <Label>Is this your first job after college? *</Label>
                  <RadioGroup
                    value={formData.is_first_job || ""}
                    onValueChange={(value) => handleInputChange("is_first_job", value)}
                    className={validationErrors.is_first_job ? "border-red-500 p-2 rounded-md border" : ""}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="first_job_yes" />
                      <Label htmlFor="first_job_yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="first_job_no" />
                      <Label htmlFor="first_job_no">No</Label>
                    </div>
                  </RadioGroup>
                  {validationErrors.is_first_job && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.is_first_job}</p>
                  )}
                </div>

                <div>
                  <Label>Job Level - First Job *</Label>
                  <RadioGroup
                    value={formData.job_level_first || ""}
                    onValueChange={(value) => handleInputChange("job_level_first", value)}
                    className={validationErrors.job_level_first ? "border-red-500 p-2 rounded-md border" : ""}
                  >
                    {[
                      "Rank or Clerical",
                      "Professional, Technical or Supervisory",
                      "Managerial or Executive",
                      "Self-employed",
                    ].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <RadioGroupItem value={level} id={`first_${level}`} />
                        <Label htmlFor={`first_${level}`}>{level}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {validationErrors.job_level_first && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.job_level_first}</p>
                  )}
                </div>

                <div>
                  <Label>Job Level - Current Job *</Label>
                  <RadioGroup
                    value={formData.job_level_current || ""}
                    onValueChange={(value) => handleInputChange("job_level_current", value)}
                    className={validationErrors.job_level_current ? "border-red-500 p-2 rounded-md border" : ""}
                  >
                    {[
                      "Rank or Clerical",
                      "Professional, Technical or Supervisory",
                      "Managerial or Executive",
                      "Self-employed",
                    ].map((level) => (
                      <div key={level} className="flex items-center space-x-2">
                        <RadioGroupItem value={level} id={`current_${level}`} />
                        <Label htmlFor={`current_${level}`}>{level}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {validationErrors.job_level_current && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.job_level_current}</p>
                  )}
                </div>

                <div>
                  <Label>Initial gross monthly earning in your first job *</Label>
                  <RadioGroup
                    value={formData.initial_gross_monthly_earning || ""}
                    onValueChange={(value) => handleInputChange("initial_gross_monthly_earning", value)}
                    className={validationErrors.initial_gross_monthly_earning ? "border-red-500 p-2 rounded-md border" : ""}
                  >
                    {[
                      "Below P5,000.00",
                      "P5,000.00 to less than P10,000.00",
                      "P10,000.00 to less than P15,000.00",
                      "P15,000.00 to less than P20,000.00",
                      "P20,000.00 to less than P25,000.00",
                      "P25,000.00 and above",
                    ].map((earning) => (
                      <div key={earning} className="flex items-center space-x-2">
                        <RadioGroupItem value={earning} id={earning} />
                        <Label htmlFor={earning}>{earning}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {validationErrors.initial_gross_monthly_earning && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.initial_gross_monthly_earning}</p>
                  )}
                </div>

                <div>
                  <Label>Was the curriculum you had in college relevant to your first job? *</Label>
                  <RadioGroup
                    value={formData.curriculum_relevant || ""}
                    onValueChange={(value) => handleInputChange("curriculum_relevant", value)}
                    className={validationErrors.curriculum_relevant ? "border-red-500 p-2 rounded-md border" : ""}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="Yes" id="curriculum_yes" />
                      <Label htmlFor="curriculum_yes">Yes</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="No" id="curriculum_no" />
                      <Label htmlFor="curriculum_no">No</Label>
                    </div>
                  </RadioGroup>
                  {validationErrors.curriculum_relevant && (
                    <p className="text-red-500 text-sm mt-1">{validationErrors.curriculum_relevant}</p>
                  )}
                </div>
              </>
            )}
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Skills and Competencies</h2>

            {formData.curriculum_relevant === "Yes" && (
              <div>
                <Label>
                  What competencies learned in college did you find very useful in your first job? (check all that
                  apply)
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                  {[
                    "Communication skills",
                    "Human Relations skills",
                    "Entrepreneurial skills",
                    "Information Technology skills",
                    "Problem-solving skills",
                    "Critical Thinking skills",
                  ].map((skill) => (
                    <div key={skill} className="flex items-center space-x-2">
                      <Checkbox
                        id={skill}
                        checked={(formData.useful_competencies || []).includes(skill)}
                        onCheckedChange={(checked) =>
                          handleCheckboxChange("useful_competencies", skill, checked as boolean)
                        }
                      />
                      <Label htmlFor={skill} className="text-sm">
                        {skill}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="curriculum_suggestions">Suggestions to further improve your course curriculum</Label>
              <Textarea
                id="curriculum_suggestions"
                value={formData.curriculum_suggestions || ""}
                onChange={(e) => handleInputChange("curriculum_suggestions", e.target.value)}
                placeholder="Please provide your suggestions for curriculum improvement"
                rows={5}
              />
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Review and Submit</h2>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold mb-2">Survey Summary</h3>
              <div className="space-y-2 text-sm">
                <p>
                  <strong>Name:</strong> {formData.name}
                </p>
                <p>
                  <strong>Email:</strong> {formData.email}
                </p>
                <p>
                  <strong>Employment Status:</strong> {formData.is_employed}
                </p>
                {formData.present_occupation && (
                  <p>
                    <strong>Occupation:</strong> {formData.present_occupation}
                  </p>
                )}
                <p>
                  <strong>Degree:</strong> {formData.degree} in {formData.specialization}
                </p>
                <p>
                  <strong>Year Graduated:</strong> {formData.year_graduated}
                </p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
              <p className="text-sm text-yellow-800">
                Note: Please review your information carefully before submitting. Once submitted, you will not be able to modify your responses, except for your employment status.
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Button variant="ghost" onClick={() => router.push("/user/dashboard")} className="mr-4">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <h1 className="text-xl font-bold text-gray-900">Graduate Tracer Survey</h1>
            </div>
            <div className="text-sm text-gray-500">
              Step {currentStep} of {totalSteps}
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Progress value={(currentStep / totalSteps) * 100} className="w-full" />
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <Card>
            <CardHeader>
              <CardTitle>Graduate Tracer Survey (GTS)</CardTitle>
              <p className="text-sm text-gray-600">
                Please complete this questionnaire as accurately and frankly as possible. Your answers will be used for
                research purposes to assess graduate employability and improve course offerings.
              </p>
            </CardHeader>
            <CardContent>{renderStep()}</CardContent>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={handlePrevious} disabled={currentStep === 1}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            {currentStep === totalSteps ? (
              <Button onClick={handleSubmit} disabled={loading} className="bg-green-600 hover:bg-green-700">
                {loading ? (
                  <>
                    <Save className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Submit Survey
                  </>
                )}
              </Button>
            ) : (
              <Button onClick={handleNext}>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}