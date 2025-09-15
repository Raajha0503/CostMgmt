"use client"

import { useState } from "react"
import { MessageSquare, Building2, FileCheck, Shield, Coins, Network, DollarSign, Database, Edit3, Save, Plus, Trash2, X, Loader2, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { communicationOperations } from "@/lib/firebase-operations"

// Define the 8 vertical subtabs with their codes
const messagingSubTabs = [
  {
    id: "cost-management",
    label: "CostManagement Messages",
    icon: DollarSign,
    description: "Messages related to cost management and allocation",
    color: "blue",
    code: "CM"
  },
  {
    id: "settlements",
    label: "Settlements Messages", 
    icon: Building2,
    description: "Settlement and clearing related communications",
    color: "green",
    code: "SM"
  },
  {
    id: "confirmations",
    label: "Confirmations Messages",
    icon: FileCheck,
    description: "Trade confirmation and validation messages",
    color: "purple",
    code: "COM"
  },
  {
    id: "regulatory",
    label: "Regulatory Messages",
    icon: Shield,
    description: "Regulatory reporting and compliance communications",
    color: "red",
    code: "REG"
  },
  {
    id: "collateral",
    label: "Collateral Messages",
    icon: Coins,
    description: "Collateral and margin management messages",
    color: "yellow",
    code: "CMS"
  },
  {
    id: "network-management",
    label: "NetworkManagement Messages",
    icon: Network,
    description: "Network and connectivity status messages",
    color: "indigo",
    code: "NM"
  },
  {
    id: "middle-office",
    label: "MiddleOffice Management",
    icon: Building2,
    description: "Middle office operations and management",
    color: "cyan",
    code: "MO"
  },
  {
    id: "reference-data",
    label: "ReferenceData Messages",
    icon: Database,
    description: "Reference data and master data updates",
    color: "gray",
    code: "RD"
  }
]

interface Message {
  id: string
  type: string
  timestamp: string
  source: string
  destination: string
  subject: string
  status: string
  priority: string
  sendTo?: string // Which subtab/team this message is sent to
  sendToCode?: string // The code of the team this message is sent to
  firebaseId?: string // Firebase document ID
  messageCategory?: string // Which subtab this message belongs to
}

export default function InternalMessagingSystem() {
  const [activeSubTab, setActiveSubTab] = useState(messagingSubTabs[0].id)
  const [loadingFromFirebase, setLoadingFromFirebase] = useState(false)
  
  // State for each subtab's messages - all start empty, data loaded from Firebase only
  const [messagesData, setMessagesData] = useState<Record<string, Message[]>>({
    "cost-management": [],
    "settlements": [],
    "confirmations": [],
    "regulatory": [],
    "collateral": [],
    "network-management": [],
    "middle-office": [],
    "reference-data": []
  })

  // Editing state
  const [editingCell, setEditingCell] = useState<{row: number, field: string} | null>(null)
  const [editingValue, setEditingValue] = useState<string>("")
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [savingRows, setSavingRows] = useState<Set<number>>(new Set())
  const [messageTypeFilter, setMessageTypeFilter] = useState<"all" | "sent" | "received">("all")

  const getCurrentMessages = () => messagesData[activeSubTab] || []

  const getMessageType = (message: Message): "sent" | "received" => {
    const currentTabCode = getCurrentTabCode()
    
    // First check if message was sent TO this tab (RECEIVED)
    if (message.sendToCode === currentTabCode && message.messageCategory !== activeSubTab) {
      return "received"
    }
    
    // Then check if message was created in this tab (SENT)
    if (message.messageCategory === activeSubTab) {
      return "sent"
    }
    
    // If message has sendTo but doesn't match current tab, it's still sent from somewhere else
    if (message.sendToCode && message.sendToCode !== currentTabCode) {
      return "received" // This tab is viewing a message not meant for it
    }
    
    // Default to sent if unclear
    return "sent"
  }

  const getFilteredMessages = () => {
    const messages = getCurrentMessages()
    
    if (messageTypeFilter === "all") {
      return messages
    }
    
    return messages.filter(message => getMessageType(message) === messageTypeFilter)
  }
  
  const getCurrentTabCode = () => {
    const currentTab = messagingSubTabs.find(tab => tab.id === activeSubTab)
    return currentTab?.code || "DEFAULT"
  }

  const handleCellEdit = (rowIndex: number, field: string, value: string) => {
    const currentMessages = getCurrentMessages()
    const updatedMessages = [...currentMessages]
    updatedMessages[rowIndex] = { ...updatedMessages[rowIndex], [field]: value }
    
    setMessagesData(prev => ({
      ...prev,
      [activeSubTab]: updatedMessages
    }))
    setHasUnsavedChanges(true)
  }

  const handleCellClick = (rowIndex: number, field: string, currentValue: string) => {
    setEditingCell({ row: rowIndex, field })
    setEditingValue(currentValue)
  }

  const handleCellSave = (rowIndex: number, field: string) => {
    handleCellEdit(rowIndex, field, editingValue)
    setEditingCell(null)
    setEditingValue("")
  }

  const handleCellCancel = () => {
    setEditingCell(null)
    setEditingValue("")
  }

  const handleAddNewMessage = () => {
    // Get messages for CURRENT subtab only (independent numbering per subtab)
    const currentMessages = getCurrentMessages()
    
    // Generate sequential message ID for THIS subtab only
    let maxNum = 0
    currentMessages.forEach(msg => {
      const match = msg.id.match(/MSG-(\d+)/)
      if (match) {
        const num = parseInt(match[1])
        if (num > maxNum) maxNum = num
      }
    })
    
    // Each subtab has its own sequence: Cost Management has MSG-001, MSG-002, etc.
    // Settlements also has MSG-001, MSG-002, etc. (independent from Cost Management)
    const newId = `MSG-${String(maxNum + 1).padStart(3, '0')}`
    
    // Generate current timestamp
    const now = new Date()
    const timestamp = now.getFullYear() + '-' + 
                     String(now.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(now.getDate()).padStart(2, '0') + ' ' + 
                     String(now.getHours()).padStart(2, '0') + ':' + 
                     String(now.getMinutes()).padStart(2, '0') + ':' + 
                     String(now.getSeconds()).padStart(2, '0')
    
    const newMessage: Message = {
      id: newId,
      type: "INFO",
      timestamp: timestamp,
      source: "New Source",
      destination: "New Destination", 
      subject: "New Message Subject",
      status: "Draft",
      priority: "Normal",
      sendTo: "",
      sendToCode: "",
      messageCategory: activeSubTab
    }

    // Add to current subtab only
    setMessagesData(prev => ({
      ...prev,
      [activeSubTab]: [...currentMessages, newMessage]
    }))
    setHasUnsavedChanges(true)
  }

  const handleDeleteMessage = async (rowIndex: number) => {
    const currentMessages = getCurrentMessages()
    const messageToDelete = currentMessages[rowIndex]
    
    // Confirm deletion
    const confirmDelete = confirm(
      `Are you sure you want to delete message "${messageToDelete.id}: ${messageToDelete.subject}"?\n\n` +
      `${messageToDelete.firebaseId ? 'This will permanently delete it from Firebase.' : 'This will delete it locally (not saved to Firebase yet).'}`
    )
    
    if (!confirmDelete) return
    
    // Add loading state for this specific row
    setSavingRows(prev => new Set(prev).add(rowIndex))
    
    try {
      // If message has Firebase ID, delete from Firebase
      if (messageToDelete.firebaseId) {
        await communicationOperations.deleteCommunication(messageToDelete.firebaseId)
        alert(`Message ${messageToDelete.id} deleted from Firebase successfully!`)
      } else {
        alert(`Message ${messageToDelete.id} deleted locally (was not saved to Firebase)`)
      }
      
      // Remove from local state
      const updatedMessages = currentMessages.filter((_, index) => index !== rowIndex)
      
      setMessagesData(prev => ({
        ...prev,
        [activeSubTab]: updatedMessages
      }))
      setHasUnsavedChanges(true)
      
    } catch (error) {
      console.error("Error deleting message:", error)
      alert(`Failed to delete message ${messageToDelete.id}. Please try again.`)
    } finally {
      // Remove from saving state
      setSavingRows(prev => {
        const newSet = new Set(prev)
        newSet.delete(rowIndex)
        return newSet
      })
    }
  }

  const handleSaveChanges = () => {
    // Here you would typically save to your backend/database
    setHasUnsavedChanges(false)
    // Show success message
    alert("Changes saved successfully!")
  }

  const handleLoadFromFirebase = async () => {
    setLoadingFromFirebase(true)
    
    try {
      // Get all records from Firebase
      const allRecords = await communicationOperations.getAllCommunications()
      
      // Filter records for current subtab
      const currentTabCode = getCurrentTabCode()
      const isSettlementsTab = currentTabCode === 'SM'
      
      const subtabRecords = allRecords.filter((record: any) => {
        // Check if record belongs to current subtab based on various field formats
        const hasTabCodeInFields = Object.keys(record).some(key => 
          key.includes(`(${currentTabCode})`) || key.includes(`_${currentTabCode}`)
        )
        
        // Check if sendTo field contains current tab code
        const sendToMatchesTab = record.sendTo && record.sendTo.includes(`(${currentTabCode})`)
        
        return (
          record.messageTabCode === currentTabCode ||
          record.messageCategory === activeSubTab ||
          hasTabCodeInFields ||
          sendToMatchesTab
        )
      })
      
      // Convert Firebase records back to Message format and sort by order
      const loadedMessages: Message[] = subtabRecords
        .map((record: any) => {
          // Try to find team code from sendTo field or look for fields with codes in brackets
          let teamCodeFromSendTo = ""
          if (record.sendTo) {
            const match = record.sendTo.match(/\(([^)]+)\)/)
            teamCodeFromSendTo = match ? match[1] : ""
          }
          
          // Look for fields with team code in brackets
          const teamCodeFromFields = Object.keys(record).find(key => 
            key.match(/\w+\s*\([A-Z]+\)/) // Matches "fieldname (CODE)" format
          )?.match(/\(([^)]+)\)/)?.[1] || ""
          
          const teamCode = teamCodeFromSendTo || teamCodeFromFields || currentTabCode || ""
          
          // Try different field name formats: "field (CODE)", "field_CODE", or plain "field"
          const getFieldValue = (fieldName: string) => {
            return record[`${fieldName} (${teamCode})`] || 
                   record[`${fieldName}_${teamCode}`] || 
                   record[fieldName] || 
                   (fieldName === 'id' ? 'MSG-001' : 
                    fieldName === 'type' ? 'INFO' : 
                    fieldName === 'timestamp' ? new Date().toISOString().slice(0, 19).replace('T', ' ') :
                    fieldName === 'source' ? 'Unknown Source' :
                    fieldName === 'destination' ? 'Unknown Destination' :
                    fieldName === 'subject' ? 'No Subject' :
                    fieldName === 'status' ? 'Draft' :
                    fieldName === 'priority' ? 'Normal' :
                    fieldName === 'order' ? 999 : '')
          }
          
          const order = getFieldValue('order') || 999
          
          return {
            id: getFieldValue('id'),
            type: getFieldValue('type'),
            timestamp: getFieldValue('timestamp'),
            source: getFieldValue('source'),
            destination: getFieldValue('destination'),
            subject: getFieldValue('subject'),
            status: getFieldValue('status'),
            priority: getFieldValue('priority'),
            sendTo: getFieldValue('sendTo'),
            sendToCode: getFieldValue('sendToCode'),
            messageCategory: record.messageCategory || activeSubTab,
            firebaseId: record.id, // Store Firebase document ID
            _order: Number(order) // Temporary field for sorting
          } as Message & { _order: number }
        })
        .sort((a: any, b: any) => (a._order || 999) - (b._order || 999))
        .map(({ _order, ...message }: any) => message) // Remove temporary _order field
      
      // Update state with loaded messages
      setMessagesData(prev => ({
        ...prev,
        [activeSubTab]: loadedMessages
      }))
      
      alert(`Refreshed ${loadedMessages.length} messages for ${getCurrentTabCode()} subtab`)
      
    } catch (error) {
      console.error("Error loading from Firebase:", error)
      alert("Failed to refresh messages. Please try again.")
    } finally {
      setLoadingFromFirebase(false)
    }
  }

  const handleSaveRow = async (rowIndex: number) => {
    const currentMessages = getCurrentMessages()
    const messageToSave = currentMessages[rowIndex]
    
    // Add this row to saving state
    setSavingRows(prev => new Set(prev).add(rowIndex))
    
    try {
      // Extract sequence number for ordering
      const sequenceMatch = messageToSave.id.match(/MSG-(\d+)/)
      const sequenceNumber = sequenceMatch ? parseInt(sequenceMatch[1]) : 999
      
      // Extract team code from sendTo field (format: "Team Name (CODE)")
      let teamCode = ""
      if (messageToSave.sendTo) {
        const codeMatch = messageToSave.sendTo.match(/\(([^)]+)\)/)
        teamCode = codeMatch ? codeMatch[1] : ""
      }
      
      // If no team code from sendTo, use current tab code as fallback
      if (!teamCode) {
        teamCode = getCurrentTabCode()
      }
      
      // Prepare data for Firebase with dynamic field names including team code
      const firebaseData: any = {
        // Required fields for unified_data collection
        trade_id: `${messageToSave.id}_${getCurrentTabCode()}_${Date.now()}`, // Unique trade_id
        data_source: "fx" as const, // Required enum value
        
        // Metadata (without team code)
        messageCategory: messageToSave.messageCategory || activeSubTab,
        messageTabCode: getCurrentTabCode(), // For easy querying
        lastUpdated: new Date().toISOString(),
        updatedBy: "Internal Messaging System",
        upload_timestamp: new Date().toISOString(),
        uploaded_as_is: true
      }

      // Always use team code in field names (either from sendTo selection or current tab)
      firebaseData[`id (${teamCode})`] = messageToSave.id
      firebaseData[`type (${teamCode})`] = messageToSave.type
      firebaseData[`timestamp (${teamCode})`] = messageToSave.timestamp
      firebaseData[`source (${teamCode})`] = messageToSave.source
      firebaseData[`destination (${teamCode})`] = messageToSave.destination
      firebaseData[`subject (${teamCode})`] = messageToSave.subject
      firebaseData[`status (${teamCode})`] = messageToSave.status
      firebaseData[`priority (${teamCode})`] = messageToSave.priority
      firebaseData[`sendTo (${teamCode})`] = messageToSave.sendTo || ""
      firebaseData[`sendToCode (${teamCode})`] = messageToSave.sendToCode || ""
      firebaseData[`order (${teamCode})`] = sequenceNumber

      let firebaseId: string

      if (messageToSave.firebaseId) {
        // Update existing document
        await communicationOperations.updateCommunication(messageToSave.firebaseId, firebaseData)
        firebaseId = messageToSave.firebaseId
      } else {
        // Create new document
        firebaseId = await communicationOperations.createCommunication(firebaseData)
        
        // Update local state with the Firebase ID
        const updatedMessages = [...currentMessages]
        updatedMessages[rowIndex] = { ...messageToSave, firebaseId }
        
        setMessagesData(prev => ({
          ...prev,
          [activeSubTab]: updatedMessages
        }))
      }

      // Show success message
      alert(`Message ${messageToSave.id} saved to Firebase successfully!`)
      
    } catch (error) {
      console.error("Error saving message:", error)
      alert(`Failed to save message ${messageToSave.id}. Please try again.`)
    } finally {
      // Remove from saving state
      setSavingRows(prev => {
        const newSet = new Set(prev)
        newSet.delete(rowIndex)
        return newSet
      })
    }
  }

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
      green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300",
      purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300",
      red: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300",
      yellow: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-300",
      indigo: "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300",
      cyan: "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-700 dark:text-cyan-300",
      gray: "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
    }
    return colorMap[color as keyof typeof colorMap] || colorMap.gray
  }

  const handleSendToChange = (rowIndex: number, selectedSubtab: string) => {
    const selectedTab = messagingSubTabs.find(tab => tab.label === selectedSubtab)
    const currentMessages = getCurrentMessages()
    const updatedMessages = [...currentMessages]
    
    // Format: "Team Name (CODE)"
    const formattedSendTo = selectedTab ? `${selectedSubtab} (${selectedTab.code})` : selectedSubtab
    
    updatedMessages[rowIndex] = { 
      ...updatedMessages[rowIndex], 
      sendTo: formattedSendTo,
      sendToCode: selectedTab?.code || ""
    }
    
    setMessagesData(prev => ({
      ...prev,
      [activeSubTab]: updatedMessages
    }))
    setHasUnsavedChanges(true)
  }

  const renderSendToCell = (value: string, rowIndex: number) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.field === "sendTo"

    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Select value={editingValue} onValueChange={setEditingValue}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select team" />
            </SelectTrigger>
            <SelectContent>
              {messagingSubTabs.map(tab => (
                <SelectItem key={tab.id} value={tab.label}>{tab.label} ({tab.code})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => {
            handleSendToChange(rowIndex, editingValue)
            setEditingCell(null)
            setEditingValue("")
          }}>
            <Save className="h-3 w-3" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleCellCancel}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    // Value already contains the code in brackets, so just display as-is
    const displayValue = value || "Not assigned"

    return (
      <div 
        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded flex items-center gap-2"
        onClick={() => handleCellClick(rowIndex, "sendTo", value)}
      >
        <Badge variant={value ? "default" : "secondary"}>
          {displayValue}
        </Badge>
        <Edit3 className="h-3 w-3 opacity-50" />
      </div>
    )
  }

  const renderDirectionCell = (message: Message) => {
    const direction = getMessageType(message)
    const variant = direction === "sent" ? "default" : "secondary" // Green for sent, Blue for received
    const bgColor = direction === "sent" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
    
    return (
      <Badge variant={variant} className={`${bgColor} font-medium`}>
        {direction.toUpperCase()}
      </Badge>
    )
  }

  const renderEditableCell = (value: string, rowIndex: number, field: string, isSelect = false, options: string[] = []) => {
    const isEditing = editingCell?.row === rowIndex && editingCell?.field === field

    if (isEditing) {
      if (isSelect) {
        return (
          <div className="flex items-center gap-2">
            <Select value={editingValue} onValueChange={setEditingValue}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => handleCellSave(rowIndex, field)}>
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCellCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )
      } else {
        return (
          <div className="flex items-center gap-2">
            <Input
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              className="w-48"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCellSave(rowIndex, field)
                if (e.key === 'Escape') handleCellCancel()
              }}
              autoFocus
            />
            <Button size="sm" variant="outline" onClick={() => handleCellSave(rowIndex, field)}>
              <Save className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCellCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )
      }
    }

    if (isSelect) {
      return (
        <div 
          className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded flex items-center gap-2"
          onClick={() => handleCellClick(rowIndex, field, value)}
        >
          <Badge variant={
            value === "ALERT" || value === "REGULATORY" ? "destructive" : 
            value === "CONFIRMATION" || value === "UPDATE" ? "default" : 
            value === "SYSTEM" ? "secondary" : "outline"
          }>
            {value}
          </Badge>
          <Edit3 className="h-3 w-3 opacity-50" />
        </div>
      )
    }

    return (
      <div 
        className="cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded flex items-center gap-2"
        onClick={() => handleCellClick(rowIndex, field, value)}
      >
        <span className="flex-1">{value}</span>
        <Edit3 className="h-3 w-3 opacity-50" />
      </div>
    )
  }

  const renderSubTabContent = () => {
    const activeTab = messagingSubTabs.find(tab => tab.id === activeSubTab)
    const currentMessages = getCurrentMessages()
    if (!activeTab) return null

    const IconComponent = activeTab.icon
    
    // Calculate statistics for current tab
    const totalMessages = currentMessages.length
    const deliveredCount = currentMessages.filter(m => m.status === "Delivered" || m.status === "Acknowledged").length
    const pendingCount = currentMessages.filter(m => m.status === "Pending" || m.status === "Draft").length
    const failedCount = currentMessages.filter(m => m.status === "Failed").length
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className={`p-6 rounded-lg border ${getColorClasses(activeTab.color)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
                <IconComponent className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{activeTab.label}</h2>
                <p className="text-sm opacity-80">{activeTab.description}</p>
                <p className="text-xs opacity-60">Independent numbering: Each subtab starts from MSG-001</p>
                <p className="text-xs opacity-50">🔗 Firebase Integration: Save to unified_data collection with unique ordering</p>
              </div>
            </div>
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-amber-600 dark:text-amber-400">Unsaved changes</span>
                <Button onClick={handleSaveChanges} size="sm">
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{totalMessages}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Messages</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{deliveredCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Delivered</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">{failedCount}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            </CardContent>
          </Card>
        </div>

        {/* Messages Table */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Recent Messages</CardTitle>
                <CardDescription>
                  Latest {activeTab.label.toLowerCase()} in the system (Click any cell to edit)
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleLoadFromFirebase} 
                  size="sm" 
                  variant="outline"
                  disabled={loadingFromFirebase}
                >
                  {loadingFromFirebase ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  {loadingFromFirebase ? "Refreshing..." : "Refresh"}
                </Button>
                <Button onClick={handleAddNewMessage} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Message
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filter Buttons */}
            <div className="flex gap-2 mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                Filter by Type:
              </span>
              <Button
                size="sm"
                variant={messageTypeFilter === "all" ? "default" : "outline"}
                onClick={() => setMessageTypeFilter("all")}
              >
                Show All
              </Button>
              <Button
                size="sm"
                variant={messageTypeFilter === "sent" ? "default" : "outline"}
                onClick={() => setMessageTypeFilter("sent")}
                className={messageTypeFilter === "sent" ? "bg-green-600 hover:bg-green-700" : ""}
              >
                Sent Only
              </Button>
              <Button
                size="sm"
                variant={messageTypeFilter === "received" ? "default" : "outline"}
                onClick={() => setMessageTypeFilter("received")}
                className={messageTypeFilter === "received" ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                Received Only
              </Button>
              <div className="ml-auto text-sm text-gray-500">
                Showing {getCurrentMessages().filter(msg => {
                  const messageType = getMessageType(msg)
                  return messageTypeFilter === "all" || messageType === messageTypeFilter
                }).length} of {getCurrentMessages().length} messages
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Message ID [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Type [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Direction [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Timestamp [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Source [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Destination [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Subject [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Status [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Priority [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Send To [{activeTab.code}]</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {getCurrentMessages().map((message, index) => {
                    const messageType = getMessageType(message)
                    const isVisible = messageTypeFilter === "all" || messageType === messageTypeFilter
                    
                    if (!isVisible) return null
                    
                    return (
                    <tr key={message.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="p-3">
                        {renderEditableCell(message.id, index, "id")}
                      </td>
                      <td className="p-3">
                        {renderEditableCell(message.type, index, "type", true, 
                          ["INFO", "ALERT", "CONFIRMATION", "REGULATORY", "SYSTEM", "UPDATE"])}
                      </td>
                      <td className="p-3">
                        {renderDirectionCell(message)}
                      </td>
                      <td className="p-3">
                        {renderEditableCell(message.timestamp, index, "timestamp")}
                      </td>
                      <td className="p-3">
                        {renderEditableCell(message.source, index, "source")}
                      </td>
                      <td className="p-3">
                        {renderEditableCell(message.destination, index, "destination")}
                      </td>
                      <td className="p-3">
                        {renderEditableCell(message.subject, index, "subject")}
                      </td>
                      <td className="p-3">
                        {renderEditableCell(message.status, index, "status", true,
                          ["Delivered", "Pending", "Acknowledged", "Failed", "Draft"])}
                      </td>
                      <td className="p-3">
                        {renderEditableCell(message.priority, index, "priority", true,
                          ["Normal", "High", "Medium", "Low", "Critical"])}
                      </td>
                      <td className="p-3">
                        {renderSendToCell(message.sendTo || "", index)}
                      </td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleSaveRow(index)}
                            disabled={savingRows.has(index)}
                          >
                            {savingRows.has(index) ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <Save className="w-3 h-3 mr-1" />
                            )}
                            {savingRows.has(index) ? "Saving..." : "Save"}
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleDeleteMessage(index)}
                            disabled={savingRows.has(index)}
                          >
                            {savingRows.has(index) ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 flex-wrap">
          <Button>
            <MessageSquare className="w-4 h-4 mr-2" />
            Send New Message
          </Button>
          <Button variant="outline">
            View All Messages
          </Button>
          <Button variant="outline">
            Configure Routing
          </Button>
          <Button 
            variant="outline"
            onClick={() => {
              if (confirm(`Load all ${getCurrentTabCode()} messages from Firebase? This will replace current data.`)) {
                handleLoadFromFirebase()
              }
            }}
            disabled={loadingFromFirebase}
          >
            <Database className="w-4 h-4 mr-2" />
            Refresh from Firebase
          </Button>
          {hasUnsavedChanges && (
            <Button variant="secondary" onClick={handleSaveChanges}>
              <Save className="w-4 h-4 mr-2" />
              Save All Changes
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      {/* Vertical Sidebar for Subtabs */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            Internal Messaging System
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage internal communications and message routing
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            Each subtab has independent numbering (MSG-001, MSG-002, etc.)
          </p>
        </div>
        
        <div className="p-2">
          {messagingSubTabs.map((tab) => {
            const IconComponent = tab.icon
            const messageCount = messagesData[tab.id]?.length || 0
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`w-full text-left p-3 rounded-lg mb-1 transition-colors duration-200 flex items-center space-x-3 ${
                  activeSubTab === tab.id
                    ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                <div className={`p-2 rounded-md ${
                  activeSubTab === tab.id ? getColorClasses(tab.color) : "bg-gray-100 dark:bg-gray-700"
                }`}>
                  <IconComponent className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm truncate">{tab.label}</div>
                    <Badge variant="secondary" className="text-xs">
                      {messageCount}
                    </Badge>
                  </div>
                  <div className="text-xs opacity-70 truncate">{tab.description}</div>
                  <div className="text-xs opacity-50">Code: {tab.code}</div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-auto">
        {renderSubTabContent()}
      </div>
    </div>
  )
} 