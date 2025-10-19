"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Users,
  FileText,
  TrendingUp,
  BarChart3,
  LogOut,
  Download,
  RefreshCw,
  Search,
  Eye,
  Edit,
  Trash2,
  FileDown,
  Activity,
  Clock,
  UserPlus,
  CheckCircle,
  Settings,
  Save,
  Maximize2,
  Minimize2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts"

export default function AdminDashboard() {
  const [limitFilter, setLimitFilter] = useState<number>(10)
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState<string>("all")
  const [analytics, setAnalytics] = useState<any>(null)
  const [alumni, setAlumni] = useState<any[]>([])
  const [recentActivities, setRecentActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [programFilter, setProgramFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
  const [selectedAlumni, setSelectedAlumni] = useState<any>(null)
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [editingAlumni, setEditingAlumni] = useState(false)
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  // Add state for activity filters
  const [activityDateFilter, setActivityDateFilter] = useState<string>('all')
  const [activityCount, setActivityCount] = useState<number>(10)
  const [activityStartDate, setActivityStartDate] = useState<string>('')
  const [activityEndDate, setActivityEndDate] = useState<string>('')
  // Add state for fullscreen iframe
  const [isFullScreen, setIsFullScreen] = useState(false)
  // Add state for survey dialog
  const [showSurveyDialog, setShowSurveyDialog] = useState(false)
  const [surveyData, setSurveyData] = useState<any>(null)
  
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    const userRole = localStorage.getItem("userRole")

    if (!token || userRole !== "admin") {
      router.push("/")
      return
    }

    fetchAllData()
  }, [router])

  // Add useEffect to handle ESC key to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullScreen])

  const fetchAllData = async () => {
    setRefreshing(true)
    await Promise.all([fetchAnalytics(), fetchAlumni(), fetchRecentActivities()])
    setRefreshing(false)
    setLoading(false)
  }

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/admin/analytics", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    }
  }

  const fetchAlumni = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/admin/alumni", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setAlumni(data)
      }
    } catch (error) {
      console.error("Error fetching alumni:", error)
    }
  }

  const fetchRecentActivities = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/admin/recent-activities", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setRecentActivities(data)
      }
    } catch (error) {
      console.error("Error fetching recent activities:", error)
    }
  }

  // Add activity filter function
  const filterActivities = (activities: any[]) => {
    let filtered = [...activities];
    
    // Apply date filters
    if (activityDateFilter !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (activityDateFilter) {
        case 'today':
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'custom':
          if (activityStartDate) {
            startDate = new Date(activityStartDate);
          }
          break;
      }
      
      filtered = filtered.filter(activity => {
        const activityDate = new Date(activity.created_at);
        return activityDate >= startDate && 
              (!activityEndDate || activityDate <= new Date(activityEndDate));
      });
    }
    
    // Apply count limit
    return filtered.slice(0, activityCount);
  };

  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userId")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userName")
    router.push("/")
  }

  const handleExportData = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/admin/export", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.style.display = "none"
        a.href = url
        a.download = "alumni_data.csv"
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        toast({
          title: "Success",
          description: "Alumni data exported successfully",
        })
      }
    } catch (error) {
      console.error("Error exporting data:", error)
      toast({
        title: "Error",
        description: "Failed to export data",
        variant: "destructive",
      })
    }
  }

  const handleGenerateReport = async (alumniId: number) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/admin/generate-report/${alumniId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.style.display = "none"
        a.href = url
        a.download = `alumni_report_${alumniId}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        toast({
          title: "Success",
          description: "Alumni report generated successfully",
        })
      }
    } catch (error) {
      console.error("Error generating report:", error)
      toast({
        title: "Error",
        description: "Failed to generate report",
        variant: "destructive",
      })
    }
  }

  const handleDeleteAlumni = async (alumniId: number) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/admin/alumni/${alumniId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: "Alumni profile deleted successfully",
        })
        fetchAllData() // Refresh all data including analytics
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.message || "Failed to delete alumni profile",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error deleting alumni:", error)
      toast({
        title: "Error",
        description: "Failed to delete alumni profile",
        variant: "destructive",
      })
    }
  }

  const handleViewProfile = (alumni: any) => {
    setSelectedAlumni(alumni)
    setShowProfileDialog(true)
  }

  const handleEditProfile = (alumni: any) => {
    setSelectedAlumni({ ...alumni })
    setShowEditDialog(true)
  }

  const handleUpdateProfile = async () => {
    if (!selectedAlumni) return

    setEditingAlumni(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/admin/alumni/${selectedAlumni.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(selectedAlumni),
      })

      const responseData = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "Alumni profile updated successfully",
        })
        setShowEditDialog(false)
        fetchAllData() // Refresh all data including analytics
      } else {
        toast({
          title: "Error",
          description: responseData.message || "Failed to update alumni profile",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error updating alumni:", error)
      toast({
        title: "Error",
        description: "Failed to update alumni profile",
        variant: "destructive",
      })
    } finally {
      setEditingAlumni(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Error",
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
          title: "Success",
          description: "Password changed successfully",
        })
        setPasswordData({ currentPassword: "", newPassword: "", confirmPassword: "" })
        setShowSettingsDialog(false)
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to change password",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error changing password:", error)
      toast({
        title: "Error",
        description: "An error occurred while changing password",
        variant: "destructive",
      })
    }
  }

  const handleViewSurvey = async (alumniId: number) => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`https://alumifyv7-e9wa3rw94-lans-projects-70b922d4.vercel.app/api/admin/survey/${alumniId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setSurveyData(data)
        setShowSurveyDialog(true)
      } else {
        toast({
          title: "Error",
          description: "Failed to load survey data",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching survey:", error)
      toast({
        title: "Error",
        description: "Failed to load survey data",
        variant: "destructive",
      })
    }
  }

  // Filter alumni based on all filters
  const filteredAlumni = alumni.filter((alumni) => {
    // Search filter (name or email)
    const matchesSearch = searchTerm 
      ? (alumni.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
         alumni.email?.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;

    // Program filter
    const matchesProgram = programFilter === "all" 
      ? true 
      : alumni.degree === programFilter;

    // Graduation year filter
    const matchesYear = yearFilter === "all" 
      ? true 
      : alumni.year_graduated?.toString() === yearFilter;

    // Employment status filter
    const matchesEmployment = employmentStatusFilter === "all"
      ? true
      : (employmentStatusFilter === "yes" && alumni.is_employed === "Yes") ||
        (employmentStatusFilter === "no" && alumni.is_employed === "No") ||
        (employmentStatusFilter === "never" && alumni.is_employed === "Never Employed");

    return matchesSearch && matchesProgram && matchesYear && matchesEmployment;
  }).slice(0, limitFilter); // Apply limit after all filtering

  // Get unique programs and years for filters
  const uniquePrograms = [...new Set(alumni.map((a) => a.degree).filter(Boolean))]
  const uniqueYears = [...new Set(alumni.map((a) => a.year_graduated).filter(Boolean))].sort((a, b) => b - a)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  const COLORS = ["#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6"]

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
              <h1 className="text-xl font-bold text-gray-900">Alumify - Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" onClick={fetchAllData} disabled={refreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" onClick={handleExportData}>
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              <Button variant="ghost" onClick={() => setShowSettingsDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
              <Button variant="ghost" onClick={handleLogout}>
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
          {/* Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Total Alumni</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics?.overview?.total_users || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Survey Responses</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics?.overview?.completed_surveys || 0}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Employment Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics?.overview?.employment_rate || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <BarChart3 className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Response Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{analytics?.overview?.response_rate || 0}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Tabs */}
          <Tabs defaultValue="analytics" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="alumni">Alumni Profiles</TabsTrigger>
              <TabsTrigger value="activities">Recent Activities</TabsTrigger>
              <TabsTrigger value="employment">Employment</TabsTrigger>
              <TabsTrigger value="trends">Trends</TabsTrigger>
            </TabsList>

            <TabsContent value="analytics" className="space-y-6">
              {/* Streamlit Dashboard Card */}
              <Card className={isFullScreen ? "fixed inset-0 z-50 m-0 p-0 w-screen h-screen" : "col-span-2"}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Insights</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="flex items-center gap-2"
                  >
                    {isFullScreen ? (
                      <>
                        <Minimize2 className="h-4 w-4" />
                        Exit Fullscreen
                      </>
                    ) : (
                      <>
                        <Maximize2 className="h-4 w-4" />
                        Fullscreen
                      </>
                    )}
                  </Button>
                </CardHeader>
                <CardContent className={isFullScreen ? "h-[calc(100vh-80px)] p-0" : "h-[600px] p-0"}>
                  <iframe
                    src="http://localhost:8501" // Streamlit URL
                    style={{ width: "100%", height: "100%", border: "none" }}
                    title="Streamlit Dashboard"
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="alumni" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Alumni Profiles Management</span>
                    <Badge variant="secondary">{filteredAlumni.length} profiles</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Search and Filters */}
                  <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={programFilter} onValueChange={setProgramFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Filter by Program" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Programs</SelectItem>
                        {uniquePrograms.map((program) => (
                          <SelectItem key={program} value={program}>
                            {program}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={yearFilter} onValueChange={setYearFilter}>
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Filter by Year" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Years</SelectItem>
                        {uniqueYears.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select 
                      value={employmentStatusFilter}
                      onValueChange={setEmploymentStatusFilter}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue placeholder="Employment Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="yes">Employed</SelectItem>
                        <SelectItem value="no">Unemployed</SelectItem>
                        <SelectItem value="never">Never Employed</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={limitFilter.toString()}
                      onValueChange={(value) => setLimitFilter(Number(value))}
                    >
                      <SelectTrigger className="w-full sm:w-28">
                        <SelectValue placeholder="Show: 10" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">Show: 10</SelectItem>
                        <SelectItem value="25">Show: 25</SelectItem>
                        <SelectItem value="50">Show: 50</SelectItem>
                        <SelectItem value="100">Show: 100</SelectItem>
                        <SelectItem value="500">Show: 500</SelectItem>
                        <SelectItem value="1000">Show: All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Alumni Table */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Program</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Employment</TableHead>
                          <TableHead>Survey</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAlumni.map((alumni) => (
                          <TableRow key={alumni.id}>
                            <TableCell className="font-medium">{alumni.name}</TableCell>
                            <TableCell>{alumni.email}</TableCell>
                            <TableCell>{alumni.degree || "N/A"}</TableCell>
                            <TableCell>{alumni.year_graduated || "N/A"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  alumni.is_employed === "Yes"
                                    ? "default"
                                    : alumni.is_employed === "No"
                                      ? "destructive"
                                      : "secondary"
                                }
                              >
                                {alumni.is_employed || "Unknown"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={alumni.survey_completed ? "default" : "secondary"}>
                                {alumni.survey_completed ? "Completed" : "Pending"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex space-x-2">
                                <Button variant="outline" size="sm" onClick={() => handleViewProfile(alumni)}>
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleEditProfile(alumni)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="sm" onClick={() => handleGenerateReport(alumni.id)}>
                                  <FileDown className="h-4 w-4" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Alumni Profile</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Are you sure you want to delete {alumni.name}'s profile? This action cannot be
                                        undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteAlumni(alumni.id)}>
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="activities" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center">
                      <Activity className="h-5 w-5 mr-2" />
                      <CardTitle>Recent Activities</CardTitle>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Select 
                        value={activityDateFilter} 
                        onValueChange={setActivityDateFilter}
                      >
                        <SelectTrigger className="w-full sm:w-40">
                          <SelectValue placeholder="Time Period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="week">This Week</SelectItem>
                          <SelectItem value="month">This Month</SelectItem>
                          <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                      </Select>

                      {activityDateFilter === 'custom' && (
                        <div className="flex gap-2">
                          <Input
                            type="date"
                            value={activityStartDate}
                            onChange={(e) => setActivityStartDate(e.target.value)}
                            className="w-full sm:w-36"
                          />
                          <Input
                            type="date"
                            value={activityEndDate}
                            onChange={(e) => setActivityEndDate(e.target.value)}
                            className="w-full sm:w-36"
                          />
                        </div>
                      )}

                      <Select
                        value={activityCount.toString()}
                        onValueChange={(value) => setActivityCount(Number(value))}
                      >
                        <SelectTrigger className="w-full sm:w-28">
                          <SelectValue placeholder="Show: 10" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">Show: 5</SelectItem>
                          <SelectItem value="10">Show: 10</SelectItem>
                          <SelectItem value="20">Show: 20</SelectItem>
                          <SelectItem value="50">Show: 50</SelectItem>
                          <SelectItem value="100">Show: 100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filterActivities(recentActivities).map((activity) => (
                      <div key={activity.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                        <div className="flex-shrink-0">
                          {activity.activity_type === "registration" && <UserPlus className="h-5 w-5 text-blue-600" />}
                          {activity.activity_type === "login" && <Users className="h-5 w-5 text-green-600" />}
                          {activity.activity_type === "survey_completed" && (
                            <CheckCircle className="h-5 w-5 text-purple-600" />
                          )}
                          {activity.activity_type === "profile_updated" && <Edit className="h-5 w-5 text-orange-600" />}
                          {activity.activity_type === "survey_started" && (
                            <FileText className="h-5 w-5 text-yellow-600" />
                          )}
                          {activity.activity_type === "survey_updated" && <Edit className="h-5 w-5 text-blue-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{activity.user_name}</p>
                          <p className="text-sm text-gray-600">{activity.description}</p>
                          <div className="flex items-center mt-1 text-xs text-gray-500">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(activity.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <Badge variant="secondary">
                            {activity.activity_type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="employment" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Employment Rate by Graduation Year</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      employment_rate: { label: "Employment Rate (%)", color: "#10B981" },
                      total_graduates: { label: "Total Graduates", color: "#3B82F6" },
                    }}
                    className="h-[400px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analytics?.graduation_years || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year_graduated" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="employment_rate" fill="#10B981" name="Employment Rate (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trends" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Employment Trends Over Time</CardTitle>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      employment_rate: { label: "Employment Rate (%)", color: "#3B82F6" },
                    }}
                    className="h-[400px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={analytics?.trends || []}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line
                          type="monotone"
                          dataKey="employment_rate"
                          stroke="#3B82F6"
                          strokeWidth={2}
                          name="Employment Rate (%)"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      {/* Profile View Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Alumni Profile - {selectedAlumni?.name}</DialogTitle>
          </DialogHeader>
          {selectedAlumni && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Personal Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Name:</span>
                      <span>{selectedAlumni.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Email:</span>
                      <span>{selectedAlumni.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Mobile:</span>
                      <span>{selectedAlumni.mobile_number || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Civil Status:</span>
                      <span>{selectedAlumni.civil_status || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Sex:</span>
                      <span>{selectedAlumni.sex || "N/A"}</span>
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
                      <span>{selectedAlumni.degree || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Specialization:</span>
                      <span>{selectedAlumni.specialization || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">University:</span>
                      <span>{selectedAlumni.college_university || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Year Graduated:</span>
                      <span>{selectedAlumni.year_graduated || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Honors:</span>
                      <span>{selectedAlumni.honors_awards || "N/A"}</span>
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
                          selectedAlumni.is_employed === "Yes"
                            ? "default"
                            : selectedAlumni.is_employed === "No"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {selectedAlumni.is_employed || "Unknown"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Occupation:</span>
                      <span>{selectedAlumni.present_occupation || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Business Line:</span>
                      <span>{selectedAlumni.business_line || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Work Location:</span>
                      <span>{selectedAlumni.place_of_work || "N/A"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Job Level:</span>
                      <span>{selectedAlumni.job_level_current || "N/A"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Survey Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="font-medium">Survey Completed:</span>
                      <Badge variant={selectedAlumni.survey_completed ? "default" : "secondary"}>
                        {selectedAlumni.survey_completed ? "Yes" : "No"}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Completed Date:</span>
                      <span>
                        {selectedAlumni.survey_completed_at
                          ? new Date(selectedAlumni.survey_completed_at).toLocaleDateString()
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Registration Date:</span>
                      <span>{new Date(selectedAlumni.created_at).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end space-x-2">
                {/* New View Survey Button */}
                <Button 
                  variant="outline" 
                  onClick={() => handleViewSurvey(selectedAlumni.id)}
                  disabled={!selectedAlumni.survey_completed}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View Survey
                </Button>
                
                <Button variant="outline" onClick={() => handleGenerateReport(selectedAlumni.id)}>
                  <FileDown className="h-4 w-4 mr-2" />
                  Generate Report
                </Button>
                <Button onClick={() => setShowProfileDialog(false)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Alumni Profile - {selectedAlumni?.name}</DialogTitle>
          </DialogHeader>
          {selectedAlumni && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={selectedAlumni.name || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      value={selectedAlumni.email || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, email: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Mobile Number</Label>
                    <Input
                      value={selectedAlumni.mobile_number || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, mobile_number: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Civil Status</Label>
                    <Select
                      value={selectedAlumni.civil_status || ""}
                      onValueChange={(value) => setSelectedAlumni({ ...selectedAlumni, civil_status: value })}
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
                      value={selectedAlumni.sex || ""}
                      onValueChange={(value) => setSelectedAlumni({ ...selectedAlumni, sex: value })}
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
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Degree</Label>
                    <Input
                      value={selectedAlumni.degree || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, degree: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Specialization</Label>
                    <Input
                      value={selectedAlumni.specialization || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, specialization: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>College/University</Label>
                    <Input
                      value={selectedAlumni.college_university || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, college_university: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Year Graduated</Label>
                    <Input
                      type="number"
                      value={selectedAlumni.year_graduated || ""}
                      onChange={(e) =>
                        setSelectedAlumni({
                          ...selectedAlumni,
                          year_graduated: Number.parseInt(e.target.value) || null,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>Employment Status</Label>
                    <Select
                      value={selectedAlumni.is_employed || ""}
                      onValueChange={(value) => setSelectedAlumni({ ...selectedAlumni, is_employed: value })}
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
                </div>
              </div>

              {selectedAlumni.is_employed === "Yes" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Present Occupation</Label>
                    <Input
                      value={selectedAlumni.present_occupation || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, present_occupation: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Business Line</Label>
                    <Input
                      value={selectedAlumni.business_line || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, business_line: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Place of Work</Label>
                    <Input
                      value={selectedAlumni.place_of_work || ""}
                      onChange={(e) => setSelectedAlumni({ ...selectedAlumni, place_of_work: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateProfile} disabled={editingAlumni}>
                  {editingAlumni ? (
                    <>
                      <Save className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Update Profile
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Settings</DialogTitle>
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

      {/* Survey Data Dialog */}
      <Dialog open={showSurveyDialog} onOpenChange={setShowSurveyDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Survey Details - {surveyData?.user?.name}</DialogTitle>
          </DialogHeader>
          {surveyData && (
            <div className="space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Personal Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Name</Label>
                    <p className="font-medium">{surveyData.user.name}</p>
                  </div>
                  <div>
                    <Label>Email</Label>
                    <p className="font-medium">{surveyData.user.email}</p>
                  </div>
                  <div>
                    <Label>Mobile Number</Label>
                    <p className="font-medium">{surveyData.graduateProfile?.mobile_number || "N/A"}</p>
                  </div>
                  <div>
                    <Label>Civil Status</Label>
                    <p className="font-medium">{surveyData.graduateProfile?.civil_status || "N/A"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Educational Background */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Educational Background</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Degree</Label>
                    <p className="font-medium">{surveyData.educationalBackground?.degree || "N/A"}</p>
                  </div>
                  <div>
                    <Label>Specialization</Label>
                    <p className="font-medium">{surveyData.educationalBackground?.specialization || "N/A"}</p>
                  </div>
                  <div>
                    <Label>University</Label>
                    <p className="font-medium">{surveyData.educationalBackground?.college_university || "N/A"}</p>
                  </div>
                  <div>
                    <Label>Year Graduated</Label>
                    <p className="font-medium">{surveyData.educationalBackground?.year_graduated || "N/A"}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Course Reasons */}
              {surveyData.courseReasons && surveyData.courseReasons.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Reasons for Taking Course</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {surveyData.courseReasons.map((reason: string, index: number) => (
                        <li key={index}>{reason}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Employment Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Employment Information</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Employment Status</Label>
                    <p className="font-medium">{surveyData.employmentData?.is_employed || "N/A"}</p>
                  </div>
                  {surveyData.employmentData?.present_occupation && (
                    <div>
                      <Label>Occupation</Label>
                      <p className="font-medium">{surveyData.employmentData.present_occupation}</p>
                    </div>
                  )}
                  {surveyData.employmentData?.business_line && (
                    <div>
                      <Label>Business Line</Label>
                      <p className="font-medium">{surveyData.employmentData.business_line}</p>
                    </div>
                  )}
                  {surveyData.employmentData?.place_of_work && (
                    <div>
                      <Label>Place of Work</Label>
                      <p className="font-medium">{surveyData.employmentData.place_of_work}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Useful Competencies */}
              {surveyData.usefulCompetencies && surveyData.usefulCompetencies.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Useful Competencies</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="list-disc list-inside space-y-1">
                      {surveyData.usefulCompetencies.map((competency: string, index: number) => (
                        <li key={index}>{competency}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Curriculum Suggestions */}
              {surveyData.curriculumSuggestions && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Curriculum Suggestions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>{surveyData.curriculumSuggestions}</p>
                  </CardContent>
                </Card>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setShowSurveyDialog(false)}>Close</Button>
              </div>
            </div>
          )}
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