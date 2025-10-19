"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { User, FileText, CheckCircle, Clock, BarChart3, LogOut, Settings, Edit, Eye, Save } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/use-toast"

export default function UserDashboard() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [surveyStatus, setSurveyStatus] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false)
  const [showEditSurveyDialog, setShowEditSurveyDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const [editingSurvey, setEditingSurvey] = useState(false)
  const [editingProfile, setEditingProfile] = useState(false)
  const [surveyData, setSurveyData] = useState<any>({})
  const [profileData, setProfileData] = useState<any>({})
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    const userName = localStorage.getItem("userName")
    const userId = localStorage.getItem("userId")

    if (!token) {
      router.push("/")
      return
    }

    setUser({ name: userName, id: userId })
    fetchUserData()
  }, [router])

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem("token")

      // Fetch survey status
      const surveyResponse = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/survey/status", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (surveyResponse.ok) {
        const surveyData = await surveyResponse.json()
        setSurveyStatus(surveyData)
      }

      // Fetch user profile
      const profileResponse = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/user/profile", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        setProfile(profileData)
        setProfileData(profileData)
      }

      // Fetch survey data for editing
      const surveyDataResponse = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/survey/data", {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (surveyDataResponse.ok) {
        const data = await surveyDataResponse.json()
        setSurveyData(data)
      }
    } catch (error) {
      console.error("Error fetching user data:", error)
      toast({
        title: "Error loading data",
        description: "Failed to fetch user information",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userId")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userName")
    router.push("/")
  }

  const handleStartSurvey = () => {
    router.push("/user/survey")
  }

  const handleEditSurvey = () => {
    setShowEditSurveyDialog(true)
  }

  const handleUpdateSurvey = async () => {
    setEditingSurvey(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/survey/update", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(surveyData),
      })

      if (response.ok) {
        toast({
          title: "Survey updated successfully",
          description: "Your employment status has been updated.",
        })
        setShowEditSurveyDialog(false)
        fetchUserData()
      } else {
        const errorData = await response.json()
        toast({
          title: "Error updating survey",
          description: errorData.message || "Failed to update survey",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating survey:", error)
      toast({
        title: "Error updating survey",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setEditingSurvey(false)
    }
  }

  // FIXED: Update profile function
  const handleUpdateProfile = async () => {
    setEditingProfile(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/user/update-profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          // Update user table
          name: profileData.name,
          // Update graduate_profiles table
          mobile_number: profileData.mobile_number,
          civil_status: profileData.civil_status,
          sex: profileData.sex,
          permanent_address: profileData.permanent_address,
          telephone: profileData.telephone,
          birthday: profileData.birthday
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        toast({
          title: "Profile updated successfully",
          description: "Your changes have been saved.",
        })
        localStorage.setItem("userName", profileData.name) // Update localStorage
        setShowEditProfileDialog(false)
        fetchUserData() // Refresh data
      } else {
        toast({
          title: "Error updating profile",
          description: data.message || "Failed to update profile",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating profile:", error)
      toast({
        title: "Error updating profile",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setEditingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Password mismatch",
        description: "New passwords do not match",
        variant: "destructive",
      })
      return
    }

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/user/change-password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwordData),
      })

      const data = await response.json()
      if (response.ok) {
        toast({
          title: "Password changed successfully",
          description: "Your password has been updated.",
        })
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
        setShowSettingsDialog(false)
      } else {
        toast({
          title: "Error changing password",
          description: data.message || "Failed to change password",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error changing password:", error)
      toast({
        title: "Error changing password",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <img
                src="/alumifylogo2.png"
                alt="Alumify Logo"
                className="h-8 w-8 object-contain"
              />
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-gray-900">Alumify</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon" onClick={() => setShowSettingsDialog(true)}>
                <Settings className="h-5 w-5" />
              </Button>
              <Button variant="ghost" onClick={() => setShowLogoutDialog(true)}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Welcome back, {user?.name}!</h1>
            <p className="mt-2 text-gray-600">Track your employment status and contribute to alumni analytics</p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Survey Status</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {surveyStatus?.is_completed ? "Completed" : "Pending"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <User className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Profile</p>
                    <p className="text-2xl font-bold text-gray-900">Active</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Contribution</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {surveyStatus?.is_completed ? "Contributing" : "Not Yet"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Survey Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Graduate Tracer Survey
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Completion Status</span>
                    <Badge variant={surveyStatus?.is_completed ? "default" : "secondary"}>
                      {surveyStatus?.is_completed ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </>
                      ) : (
                        <>
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </>
                      )}
                    </Badge>
                  </div>

                  <Progress value={surveyStatus?.is_completed ? 100 : 0} className="w-full" />

                  <p className="text-sm text-gray-600">
                    {surveyStatus?.is_completed
                      ? "Thank you for completing the survey! You can update your employment status anytime."
                      : "Please complete the Graduate Tracer Survey to help us track employment trends and improve our programs."}
                  </p>

                  <div className="flex gap-2">
                    {!surveyStatus?.is_completed ? (
                      <Button onClick={handleStartSurvey} className="flex-1">
                        Start Survey
                      </Button>
                    ) : (
                      <Button onClick={handleEditSurvey} className="flex-1 bg-transparent" variant="outline">
                        <Edit className="h-4 w-4 mr-2" />
                        Update Employment Status
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profile Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Profile Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">Manage your personal information and employment details.</p>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Name:</span>
                      <span className="font-medium">{user?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Status:</span>
                      <Badge variant="outline">Alumni</Badge>
                    </div>
                    {profile?.degree && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Degree:</span>
                        <span className="font-medium">{profile.degree}</span>
                      </div>
                    )}
                  </div>

                  <Button onClick={() => setShowProfileDialog(true)} variant="outline" className="w-full">
                    <Eye className="h-4 w-4 mr-2" />
                    View Full Profile
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {surveyStatus?.completed_at ? (
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <div>
                      <p className="text-sm font-medium">Survey Completed</p>
                      <p className="text-xs text-gray-500">
                        Completed on {new Date(surveyStatus.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-yellow-600" />
                    <div>
                      <p className="text-sm font-medium">Survey Pending</p>
                      <p className="text-xs text-gray-500">Please complete the Graduate Tracer Survey</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-3">
                  <User className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">Account Created</p>
                    <p className="text-xs text-gray-500">Welcome to Alumify</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Profile View Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
            <DialogDescription>
              View and manage your personal information
            </DialogDescription>
          </DialogHeader>
          {profile && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex justify-between items-center">
                      Personal Information
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setProfileData(profile)
                          setShowEditProfileDialog(true)
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Name:</span>
                      <span>{profile.name || user?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Email:</span>
                      <span>{profile.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Mobile:</span>
                      <span>{profile.mobile_number || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Civil Status:</span>
                      <span>{profile.civil_status || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Sex:</span>
                      <span>{profile.sex || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Educational Background</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Degree:</span>
                      <span>{profile.degree || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Specialization:</span>
                      <span>{profile.specialization || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">University:</span>
                      <span>{profile.college_university || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Year Graduated:</span>
                      <span>{profile.year_graduated || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Employment Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Employed:</span>
                      <Badge
                        variant={
                          profile.is_employed === "Yes"
                            ? "default"
                            : profile.is_employed === "No"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {profile.is_employed || "Unknown"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Occupation:</span>
                      <span>{profile.present_occupation || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Business Line:</span>
                      <span>{profile.business_line || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Work Location:</span>
                      <span>{profile.place_of_work || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Survey Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Survey Status:</span>
                      <Badge variant={surveyStatus?.is_completed ? "default" : "secondary"}>
                        {surveyStatus?.is_completed ? "Completed" : "Pending"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Completed Date:</span>
                      <span>
                        {surveyStatus?.completed_at ? new Date(surveyStatus.completed_at).toLocaleDateString() : "N/A"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog - ENHANCED with more fields */}
      <Dialog open={showEditProfileDialog} onOpenChange={setShowEditProfileDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Personal Information</DialogTitle>
            <DialogDescription>
              Update your personal details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                value={profileData.name || ""}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <Label>Mobile Number</Label>
              <Input
                value={profileData.mobile_number || ""}
                onChange={(e) => setProfileData({ ...profileData, mobile_number: e.target.value })}
                placeholder="Enter mobile number"
              />
            </div>

            <div>
              <Label>Permanent Address</Label>
              <Input
                value={profileData.permanent_address || ""}
                onChange={(e) => setProfileData({ ...profileData, permanent_address: e.target.value })}
                placeholder="Enter permanent address"
              />
            </div>

            <div>
              <Label>Telephone</Label>
              <Input
                value={profileData.telephone || ""}
                onChange={(e) => setProfileData({ ...profileData, telephone: e.target.value })}
                placeholder="Enter telephone number"
              />
            </div>

            <div>
              <Label>Civil Status</Label>
              <Select
                value={profileData.civil_status || ""}
                onValueChange={(value) => setProfileData({ ...profileData, civil_status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select civil status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Single">Single</SelectItem>
                  <SelectItem value="Married">Married</SelectItem>
                  <SelectItem value="Separated">Separated</SelectItem>
                  <SelectItem value="Widow or Widower">Widow or Widower</SelectItem>
                  <SelectItem value="Single Parent">Single Parent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Sex</Label>
              <Select
                value={profileData.sex || ""}
                onValueChange={(value) => setProfileData({ ...profileData, sex: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Male">Male</SelectItem>
                  <SelectItem value="Female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Birthday</Label>
              <Input
                type="date"
                value={profileData.birthday || ""}
                onChange={(e) => setProfileData({ ...profileData, birthday: e.target.value })}
              />
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditProfileDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateProfile} disabled={editingProfile}>
                {editingProfile ? (
                  <>
                    <Save className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Survey Dialog */}
      <Dialog open={showEditSurveyDialog} onOpenChange={setShowEditSurveyDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Update Employment Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Are you currently employed?</Label>
              <Select
                value={surveyData.is_employed || ""}
                onValueChange={(value) => setSurveyData({ ...surveyData, is_employed: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employment status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Yes">Yes</SelectItem>
                  <SelectItem value="No">No</SelectItem>
                  <SelectItem value="Never Employed">Never Employed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {surveyData.is_employed === "Yes" && (
              <>
                <div>
                  <Label>Present Occupation</Label>
                  <Input
                    value={surveyData.present_occupation || ""}
                    onChange={(e) => setSurveyData({ ...surveyData, present_occupation: e.target.value })}
                    placeholder="e.g., Software Engineer, Teacher"
                  />
                </div>

                <div>
                  <Label>Employment Status</Label>
                  <Select
                    value={surveyData.employment_status || ""}
                    onValueChange={(value) => setSurveyData({ ...surveyData, employment_status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select employment status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Regular or Permanent">Regular or Permanent</SelectItem>
                      <SelectItem value="Contractual">Contractual</SelectItem>
                      <SelectItem value="Temporary">Temporary</SelectItem>
                      <SelectItem value="Self-employed">Self-employed</SelectItem>
                      <SelectItem value="Casual">Casual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Business Line</Label>
                  <Select
                    value={surveyData.business_line || ""}
                    onValueChange={(value) => setSurveyData({ ...surveyData, business_line: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select business line" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Agriculture, Hunting and Forestry">
                        Agriculture, Hunting and Forestry
                      </SelectItem>
                      <SelectItem value="Fishing">Fishing</SelectItem>
                      <SelectItem value="Mining and Quarrying">Mining and Quarrying</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Electricity, Gas and Water Supply">
                        Electricity, Gas and Water Supply
                      </SelectItem>
                      <SelectItem value="Construction">Construction</SelectItem>
                      <SelectItem value="Wholesale and Retail Trade">Wholesale and Retail Trade</SelectItem>
                      <SelectItem value="Hotels and Restaurants">Hotels and Restaurants</SelectItem>
                      <SelectItem value="Transport Storage and Communication">
                        Transport Storage and Communication
                      </SelectItem>
                      <SelectItem value="Financial Intermediation">Financial Intermediation</SelectItem>
                      <SelectItem value="Real Estate, Renting and Business Activities">
                        Real Estate, Renting and Business Activities
                      </SelectItem>
                      <SelectItem value="Public Administration and Defense">
                        Public Administration and Defense
                      </SelectItem>
                      <SelectItem value="Education">Education</SelectItem>
                      <SelectItem value="Health and Social Work">Health and Social Work</SelectItem>
                      <SelectItem value="Other Community, Social and Personal Service Activities">
                        Other Community, Social and Personal Service Activities
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Place of Work</Label>
                  <Select
                    value={surveyData.place_of_work || ""}
                    onValueChange={(value) => setSurveyData({ ...surveyData, place_of_work: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select place of work" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Local">Local</SelectItem>
                      <SelectItem value="Abroad">Abroad</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowEditSurveyDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateSurvey} disabled={editingSurvey}>
                {editingSurvey ? (
                  <>
                    <Save className="h-4 w-4 mr-2 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Update
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Account Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                placeholder="Enter current password"
              />
            </div>
            <div>
              <Label>New Password</Label>
              <Input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword}>Change Password</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out of your account?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Footer */}
      <footer className="bg-white border-t py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} Alumify
            </p>
            <div className="mt-2 md:mt-0">
              <p className="text-sm text-gray-500">
                Solution by: Alumify Team - 
                <span className="ml-2">Franjo Christopher M. Lorena,</span>
                <span className="ml-2">Carlos O. Lopez,</span>
                <span className="ml-2">Charmane M. Monis,</span>
                <span className="ml-2">Sunshine L. Tabios</span>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}