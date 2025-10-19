"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shield, ArrowRight, ArrowLeft } from "lucide-react"
import { useRouter } from "next/navigation"

export default function PrivacyAgreement() {
  const [agreed, setAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem("token")
    const userRole = localStorage.getItem("userRole")

    if (!token) {
      router.push("/")
      return
    }

    // Check if user already accepted privacy
    checkPrivacyStatus()
  }, [router])

  const checkPrivacyStatus = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/user/privacy-status", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        if (data.privacy_accepted) {
          // User already accepted, redirect to dashboard
          const userRole = localStorage.getItem("userRole")
          if (userRole === "admin") {
            router.push("/admin/dashboard")
          } else {
            router.push("/user/dashboard")
          }
        }
      }
    } catch (error) {
      console.error("Error checking privacy status:", error)
    }
  }

  const handleAccept = async () => {
    if (!agreed) return

    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/user/accept-privacy", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      })

      if (response.ok) {
        const userRole = localStorage.getItem("userRole")
        if (userRole === "admin") {
          router.push("/admin/dashboard")
        } else {
          router.push("/user/dashboard")
        }
      }
    } catch (error) {
      console.error("Error accepting privacy:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDecline = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("userId")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userName")
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Shield className="h-12 w-12 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Privacy Agreement</CardTitle>
          <p className="text-gray-600">Please read and accept our privacy policy to continue</p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full border rounded-lg p-6 mb-6 bg-white">
            <div className="space-y-4 text-sm">
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-gray-900">Privacy Clause for Alumify</h2>
                <p className="text-gray-600">Last Updated: 07/12/2025</p>
              </div>

              <p className="text-gray-700">
                This web application is part of an academic research project conducted by 4th Year BSIT Students from
                ISPSC-Tagudin Campus. By using this site, you agree to the following privacy terms:
              </p>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">1. Data Collection</h3>
                  <p className="text-gray-700 mb-2">We may collect:</p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>
                      <strong>Personal Data:</strong> Only if voluntarily provided (e.g., survey responses, email for
                      contact).
                    </li>
                    <li>
                      <strong>Usage Data:</strong> Anonymous analytics (e.g., page visits, interactions).
                    </li>
                    <li>
                      <strong>Cookies:</strong> Used for functionality (you can disable them in browser settings).
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">2. Purpose of Data</h3>
                  <p className="text-gray-700 mb-2">
                    Your information will be used strictly for research purposes, including:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>Analyzing user behavior for academic findings.</li>
                    <li>Improving the site's usability (for project evaluation).</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">3. Data Protection</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>All data will be stored securely and anonymized where possible.</li>
                    <li>
                      No personal data will be shared publicly; aggregated results only will be used in reports/thesis.
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">4. Third Parties</h3>
                  <p className="text-gray-700">
                    No commercial sharing of data. Anonymous usage data may be processed by platforms like
                    Firebase/Analytics (if applicable).
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">5. Your Rights</h3>
                  <ul className="list-disc list-inside space-y-1 text-gray-700 ml-4">
                    <li>Request deletion of your data by contacting alumify.01@gmail.com.</li>
                    <li>Decline to participate without penalty.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">6. Contact</h3>
                  <p className="text-gray-700">
                    For questions, Facebook: <strong>Franjo Christopher Lorena</strong>
                  </p>
                </div>
              </div>
            </div>
          </ScrollArea>

          <div className="flex items-center space-x-2 mb-6">
            <Checkbox id="privacy-agreement" checked={agreed} onCheckedChange={setAgreed} />
            <label
              htmlFor="privacy-agreement"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I have read and agree to the privacy policy and terms of use
            </label>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={handleDecline}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Decline & Exit
            </Button>
            <Button onClick={handleAccept} disabled={!agreed || loading}>
              {loading ? "Processing..." : "Accept & Continue"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
