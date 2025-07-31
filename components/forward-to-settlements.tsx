"use client"

import React, { useState } from "react"
import * as XLSX from "xlsx"
import { Button } from "@/components/ui/button"
import { collection, getDocs, updateDoc, doc, addDoc, deleteField } from "firebase/firestore"
import { db } from "@/lib/firebase-config"
import { RefreshCw, Download } from "lucide-react"

// Helper functions (copied from captured-from-cms.tsx)
function formatCurrency(amount?: string, currency?: string) {
  if (!amount || !currency) return ""
  return `${Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}
function formatDate(dateString?: string) {
  if (!dateString || dateString === "########") return "-"
  const d = new Date(dateString)
  return isNaN(d.getTime()) ? dateString : d.toLocaleDateString()
}
function safeParseFloat(value?: string): number {
  if (!value) return 0
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

export default function ForwardToSettlements() {
  const [tableData, setTableData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [dragActive, setDragActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [editLoading, setEditLoading] = useState<string | null>(null)
  const [unifiedData, setUnifiedData] = React.useState<any[]>([]);
  const [unifiedHeaders, setUnifiedHeaders] = React.useState<string[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const [uploadSuccess, setUploadSuccess] = React.useState(false);
  const [saveLoading, setSaveLoading] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<string>("");
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const [deleteMessage, setDeleteMessage] = React.useState<string>("");
  const [csvUploadLoading, setCsvUploadLoading] = React.useState(false);
  const [csvUploadMessage, setCsvUploadMessage] = React.useState<string>("");

  // Add index signature to cost row type for dynamic access
  type CostRow = { [key: string]: string };

  const collectionName = "forexClients"

  const handleFile = (file: File) => {
    // Prevent duplicate uploads
    if (csvUploadLoading) {
      console.log("Upload already in progress, skipping")
      return
    }
    
    console.log("Starting file processing for:", file.name)
    const reader = new FileReader()
    const isCSV = file.name.toLowerCase().endsWith(".csv")
    
    reader.onload = async (evt) => {
      const data = evt.target?.result
      if (!data) return
      
      setCsvUploadLoading(true)
      setCsvUploadMessage("")
      
      let jsonData: any[][] = []
      if (isCSV) {
        const text = data as string
        const lines = text.split("\n").filter(line => line.trim())
        jsonData = lines.map(line => line.split(",").map(cell => cell.replace(/^"|"$/g, "")))
      } else {
        const workbook = XLSX.read(data, { type: "binary" })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]
      }
      
      if (jsonData.length > 0) {
        const headers = jsonData[0].map((h: any) => String(h))
        const rows = jsonData.slice(1)
        
        // Set local state
        setHeaders(headers)
        setTableData(rows)
        
        // Upload to Firebase 'unified_data' collection
        try {
          console.log("Starting upload to unified_data")
          console.log("Headers:", headers)
          console.log("Total rows to upload:", rows.length)
          console.log("Raw rows data:", rows)
          
          const colRef = collection(db, "unified_data")
          let successCount = 0
          
          // Filter out empty rows (rows where all cells are empty)
          const validRows = rows.filter(row => 
            row.some(cell => cell && cell.toString().trim() !== "")
          )
          
          console.log("Valid rows after filtering:", validRows.length)
          
          for (let i = 0; i < validRows.length; i++) {
            const row = validRows[i]
            try {
              // Convert array row to object using headers as keys
              const rowObj: any = {}
              headers.forEach((header, index) => {
                rowObj[header] = row[index] || ""
              })
              
              console.log(`Uploading row ${i + 1}:`, rowObj)
              await addDoc(colRef, rowObj)
              successCount++
            } catch (error) {
              console.error("Failed to upload row:", error)
            }
          }
          
          setCsvUploadMessage(`Successfully uploaded ${successCount} of ${validRows.length} valid rows to unified_data collection.`)
        } catch (error) {
          setCsvUploadMessage(`Failed to upload to Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      } else {
        setHeaders([])
        setTableData([])
        setCsvUploadMessage("No data found in the uploaded file.")
      }
      
      setCsvUploadLoading(false)
    }
    
    if (isCSV) {
      reader.readAsText(file)
    } else {
      reader.readAsBinaryString(file)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
      }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    }

  const handleSourceFromFirebase = async () => {
    setLoading(true)
    try {
      // Fetch from NWM_Management collection
      const querySnapshot = await getDocs(collection(db, 'NWM_Management'))
      const docs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      if (docs.length > 0) {
        const headers = Object.keys(docs[0])
        setHeaders(headers)
        // Ensure data values are ordered to match headers
        const orderedData = docs.map((doc: any) => 
          headers.map(header => doc[header])
        )
        setTableData(orderedData)
        
        // Auto-assign document IDs to cost management data
        const documentIds = docs.map(doc => doc.id)
        setEditableCostData(prevData => 
          prevData.map((item, index) => ({
            ...item,
            assignedDocumentId: index < documentIds.length ? documentIds[index] : ""
          }))
        )
      } else {
        setHeaders([])
        setTableData([])
        // Clear assigned document IDs if no Firebase data
        setEditableCostData(prevData => 
          prevData.map(item => ({ ...item, assignedDocumentId: "" }))
        )
      }
    } catch (err) {
      setHeaders([])
      setTableData([])
      // Clear assigned document IDs on error
      setEditableCostData(prevData => 
        prevData.map(item => ({ ...item, assignedDocumentId: "" }))
      )
    }
    setLoading(false)
  }

  // Handle cell edit
  const handleCellEdit = async (rowIdx: number, colIdx: number, value: string) => {
    const row = tableData[rowIdx]
    const id = row[headers.indexOf("id")]
    if (!id) return
    // Update local state
    const newTableData = tableData.map((r: any[], i: number) =>
      i === rowIdx ? r.map((cell: any, j: number) => (j === colIdx ? value : cell)) : r
    )
    setTableData(newTableData)
    // Update Firestore
    setEditLoading(`${rowIdx}-${colIdx}`)
    try {
      await updateDoc(doc(db, 'NWM_Management', id), { [headers[colIdx]]: value })
    } catch (e) {
      // Optionally handle error
    }
    setEditLoading(null)
  }

  // Cost data state and handlers
  const hardcodedCostData = [
    { TradeID: "FX0010", FXGainLoss: "-4783.35", PnlCalculated: "-7541.58", CostAllocationStatus: "Failed", ExpenseApprovalStatus: "Rejected", CostBookedDate: "5/31/2025", CommissionAmount: "701.09", CommissionCurrency: "CHF", BrokerageFee: "307.57", BrokerageCurrency: "CHF", assignedDocumentId: "" },
    { TradeID: "FX0051", FXGainLoss: "-1587.58", PnlCalculated: "-1477.41", CostAllocationStatus: "Allocated", ExpenseApprovalStatus: "Rejected", CostBookedDate: "########", CommissionAmount: "463.81", CommissionCurrency: "CHF", BrokerageFee: "78.83", BrokerageCurrency: "CHF", assignedDocumentId: "" },
    { TradeID: "FX0055", FXGainLoss: "179.9", PnlCalculated: "-2476.08", CostAllocationStatus: "Failed", ExpenseApprovalStatus: "Under Review", CostBookedDate: "########", CommissionAmount: "996.49", CommissionCurrency: "USD", BrokerageFee: "96.97", BrokerageCurrency: "USD", assignedDocumentId: "" },
    { TradeID: "FX0100", FXGainLoss: "-4894.43", PnlCalculated: "-5282.09", CostAllocationStatus: "Allocated", ExpenseApprovalStatus: "Under Review", CostBookedDate: "5/24/2025", CommissionAmount: "840.23", CommissionCurrency: "USD", BrokerageFee: "488.65", BrokerageCurrency: "USD", assignedDocumentId: "" },
    { TradeID: "FX0111", FXGainLoss: "-4458.74", PnlCalculated: "-9068.05", CostAllocationStatus: "Pending", ExpenseApprovalStatus: "Under Review", CostBookedDate: "5/13/2025", CommissionAmount: "218.27", CommissionCurrency: "USD", BrokerageFee: "482.44", BrokerageCurrency: "USD", assignedDocumentId: "" },
    { TradeID: "FX0123", FXGainLoss: "1836", PnlCalculated: "-9529.88", CostAllocationStatus: "Failed", ExpenseApprovalStatus: "Rejected", CostBookedDate: "########", CommissionAmount: "836.84", CommissionCurrency: "USD", BrokerageFee: "387.09", BrokerageCurrency: "USD", assignedDocumentId: "" },
    { TradeID: "FX0141", FXGainLoss: "-1501.39", PnlCalculated: "-1399.27", CostAllocationStatus: "Pending", ExpenseApprovalStatus: "Under Review", CostBookedDate: "########", CommissionAmount: "765.49", CommissionCurrency: "USD", BrokerageFee: "272.8", BrokerageCurrency: "USD", assignedDocumentId: "" },
    { TradeID: "FX0187", FXGainLoss: "223.31", PnlCalculated: "-8693.08", CostAllocationStatus: "Pending", ExpenseApprovalStatus: "Approved", CostBookedDate: "5/19/2025", CommissionAmount: "572.74", CommissionCurrency: "USD", BrokerageFee: "202.57", BrokerageCurrency: "USD", assignedDocumentId: "" },
    { TradeID: "FX0194", FXGainLoss: "3335.58", PnlCalculated: "-9125.16", CostAllocationStatus: "Allocated", ExpenseApprovalStatus: "Rejected", CostBookedDate: "5/22/2025", CommissionAmount: "921.02", CommissionCurrency: "USD", BrokerageFee: "61.87", BrokerageCurrency: "USD", assignedDocumentId: "" },
    { TradeID: "FX0195", FXGainLoss: "-3353.42", PnlCalculated: "-1516.87", CostAllocationStatus: "Failed", ExpenseApprovalStatus: "Approved", CostBookedDate: "5/19/2025", CommissionAmount: "777.69", CommissionCurrency: "CHF", BrokerageFee: "301.56", BrokerageCurrency: "CHF", assignedDocumentId: "" },
    { TradeID: "FX0198", FXGainLoss: "-2205.69", PnlCalculated: "768.3", CostAllocationStatus: "Failed", ExpenseApprovalStatus: "Under Review", CostBookedDate: "5/23/2025", CommissionAmount: "567.37", CommissionCurrency: "JPY", BrokerageFee: "156.59", BrokerageCurrency: "JPY", assignedDocumentId: "" },
  ];
  const [editableCostData, setEditableCostData] = React.useState(hardcodedCostData.map(item => ({ ...item })));

  function handleCostCellChange(rowIndex: number, field: string, value: string) {
    setEditableCostData(data => data.map((row, i) => i === rowIndex ? { ...row, [field]: value } : row));
  }

  // Editable cell component
  function EditableCell({ value, rowIndex, field, type = "text", className = "", onChange }: {
    value: string
    rowIndex: number
    field: string
    type?: "text" | "number" | "date"
    className?: string
    onChange: (rowIndex: number, field: string, value: string) => void
  }) {
    const [editing, setEditing] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(value);
    React.useEffect(() => { setInputValue(value); }, [value]);
    return editing ? (
      <input
        type={type}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onBlur={() => { setEditing(false); onChange(rowIndex, field, inputValue); }}
        onKeyDown={e => { if (e.key === "Enter") { setEditing(false); onChange(rowIndex, field, inputValue); }}}
        className={`w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-800 ${className}`}
        autoFocus
      />
    ) : (
      <div
        onClick={() => setEditing(true)}
        className={`cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 px-2 py-1 rounded transition-colors ${className}`}
        title="Click to edit"
      >
        {value || <span className="text-gray-400 italic">Click to edit</span>}
      </div>
    );
  }

  // Status dropdown component
  function StatusDropdown({ value, rowIndex, field, options, onChange }: {
    value: string
    rowIndex: number
    field: string
    options: string[]
    onChange: (rowIndex: number, field: string, value: string) => void
  }) {
    return (
      <select
        value={value}
        onChange={e => onChange(rowIndex, field, e.target.value)}
        className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map(option => <option key={option} value={option}>{option}</option>)}
      </select>
    );
  }

  function unifyData() {
    // Only unify if both tables have data
    if (tableData.length === 0 || editableCostData.length === 0) return;
    
    // Get headers for both tables
    const firebaseHeaders = headers;
    const costHeaders = Object.keys(editableCostData[0] || {});
    // Avoid duplicate columns by suffixing cost columns if needed
    const unifiedHeaders = [
      ...firebaseHeaders,
      ...costHeaders.map(h => firebaseHeaders.includes(h) ? h + '_cost' : h)
    ];
    setUnifiedHeaders(unifiedHeaders);
    
    // Create a map of document ID to Firebase row for efficient lookup
    const firebaseRowMap = new Map();
    tableData.forEach((row, index) => {
      const idColIndex = firebaseHeaders.indexOf('id');
      if (idColIndex !== -1) {
        const documentId = row[idColIndex];
        firebaseRowMap.set(documentId, row);
      }
    });
    
    // Merge rows by document ID matching
    const unifiedRows: any[] = [];
    editableCostData.forEach(costRow => {
      const assignedDocId = costRow.assignedDocumentId;
      // Only process cost rows that have assigned document IDs
      if (assignedDocId && firebaseRowMap.has(assignedDocId)) {
        const firebaseRow = firebaseRowMap.get(assignedDocId);
        const rowObj: any = {};
        
        // Add Firebase data
        firebaseHeaders.forEach((h, idx) => { 
          rowObj[h] = firebaseRow[idx]; 
        });
        
        // Add cost data
        costHeaders.forEach(h => {
          const key = firebaseHeaders.includes(h) ? h + '_cost' : h;
          rowObj[key] = (costRow as CostRow)[h];
        });
        
        unifiedRows.push(rowObj);
      }
    });
    
    setUnifiedData(unifiedRows);
  }

  async function uploadUnifiedToFirebase() {
    if (unifiedData.length === 0) return;
    setUploading(true);
    setUploadSuccess(false);
    try {
      const colRef = collection(db, "cost_management");
      for (const row of unifiedData) {
        await addDoc(colRef, row);
      }
      setUploadSuccess(true);
    } catch (e) {
      // Optionally handle error
      setUploadSuccess(false);
    }
    setUploading(false);
  }

  async function saveCostDataToFirebase() {
    setSaveLoading(true);
    setSaveMessage("");
    
    // Filter rows that have assigned document IDs
    const rowsToSave = editableCostData.filter(row => row.assignedDocumentId && row.assignedDocumentId.trim() !== "");
    
    if (rowsToSave.length === 0) {
      setSaveMessage("No rows with assigned document IDs to save.");
      setSaveLoading(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const row of rowsToSave) {
      try {
        // Create update object with all fields except assignedDocumentId
        const updateData: any = {};
        Object.keys(row).forEach(key => {
          if (key !== 'assignedDocumentId') {
            updateData[key] = row[key as keyof typeof row];
          }
        });

        // Update the document in NWM_Management collection
        await updateDoc(doc(db, 'NWM_Management', row.assignedDocumentId), updateData);
        successCount++;
      } catch (error) {
        errorCount++;
        errors.push(`Failed to update ${row.TradeID}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Set success/error message
    if (errorCount === 0) {
      setSaveMessage(`Successfully saved ${successCount} rows to NWM_Management.`);
    } else if (successCount === 0) {
      setSaveMessage(`Failed to save all ${errorCount} rows. ${errors.slice(0, 3).join('; ')}`);
    } else {
      setSaveMessage(`Saved ${successCount} rows successfully, ${errorCount} failed. ${errors.slice(0, 2).join('; ')}`);
    }

    setSaveLoading(false);
  }

  async function deleteCostDataFromFirebase() {
    console.log("Delete function called");
    console.log("editableCostData:", editableCostData);
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      "Are you sure you want to delete the cost management fields from Firebase? This action cannot be undone."
    );
    
    console.log("Confirmation result:", confirmed);
    if (!confirmed) return;

    setDeleteLoading(true);
    setDeleteMessage("");
    
    // Filter rows that have assigned document IDs
    const rowsToDelete = editableCostData.filter(row => row.assignedDocumentId && row.assignedDocumentId.trim() !== "");
    console.log("Rows to delete:", rowsToDelete.length, rowsToDelete);
    
    if (rowsToDelete.length === 0) {
      setDeleteMessage("No rows with assigned document IDs to delete.");
      setDeleteLoading(false);
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const row of rowsToDelete) {
      try {
        console.log(`Processing row: ${row.TradeID}, Document ID: ${row.assignedDocumentId}`);
        
        // Create delete object with all fields except assignedDocumentId
        const deleteData: any = {};
        Object.keys(row).forEach(key => {
          if (key !== 'assignedDocumentId') {
            deleteData[key] = deleteField();
          }
        });

        console.log("Delete data object:", deleteData);

        // Update the document in NWM_Management collection to delete fields
        await updateDoc(doc(db, 'NWM_Management', row.assignedDocumentId), deleteData);
        console.log(`Successfully deleted fields from document: ${row.assignedDocumentId}`);
        successCount++;
      } catch (error) {
        console.error(`Error deleting from ${row.TradeID}:`, error);
        errorCount++;
        errors.push(`Failed to delete from ${row.TradeID}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Set success/error message
    if (errorCount === 0) {
      setDeleteMessage(`Successfully deleted cost management fields from ${successCount} documents in NWM_Management.`);
    } else if (successCount === 0) {
      setDeleteMessage(`Failed to delete from all ${errorCount} documents. ${errors.slice(0, 3).join('; ')}`);
    } else {
      setDeleteMessage(`Deleted from ${successCount} documents successfully, ${errorCount} failed. ${errors.slice(0, 2).join('; ')}`);
    }

    setDeleteLoading(false);
  }

  // Add a function to delete a column from the unified table
  function deleteUnifiedColumn(col: string) {
    setUnifiedHeaders(prev => prev.filter(h => h !== col));
    setUnifiedData(prev => prev.map(row => {
      const newRow = { ...row };
      delete newRow[col];
      return newRow;
    }));
  }

  return (
    <div className="max-w-3xl mx-auto py-8 space-y-8 border-l-2 border-white">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`mb-6 border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-900" : "border-gray-300 bg-gray-50 dark:bg-gray-700"
        }`}
        style={{ minHeight: 80 }}
      >
        <div className="flex flex-col items-center justify-center h-full">
          <span className="text-gray-700 dark:text-gray-200">
            {csvUploadLoading ? "Uploading to unified_data..." : "Drag and drop Excel or CSV file here"}
          </span>
        </div>
      </div>
      {csvUploadMessage && (
        <div className={`mb-4 p-3 rounded-md text-sm ${
          csvUploadMessage.includes('Successfully') 
            ? 'bg-green-100 text-green-800 border border-green-300' 
            : csvUploadMessage.includes('Failed')
            ? 'bg-red-100 text-red-800 border border-red-300'
            : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
        }`}>
          {csvUploadMessage}
        </div>
      )}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Upload Excel or CSV File
        </label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 dark:bg-gray-700 dark:text-gray-200 focus:outline-none"
        />
      </div>
      <Button onClick={handleSourceFromFirebase} disabled={loading} className="mb-6">
        {loading ? "Loading..." : "Source Data from Firebase"}
              </Button>
      {headers.length > 0 && (
                <div className="overflow-x-auto max-h-96">
          <table className="min-w-full text-sm border">
                    <thead>
                      <tr>
                {headers.map((col) => (
                  <th key={col} className="px-2 py-1 border-b font-semibold text-left bg-gray-100 dark:bg-gray-800" style={{ minWidth: 200 }}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
              {tableData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {headers.map((col, colIdx) => (
                    <td key={colIdx} className="px-2 py-1 border-b" style={{ minWidth: 200 }}>
                      {typeof row[colIdx] === "object" && row[colIdx] !== null && "seconds" in row[colIdx] && "nanoseconds" in row[colIdx]
                        ? new Date(row[colIdx].seconds * 1000).toLocaleString()
                        : (
                          <input
                            className="w-full bg-transparent border-none focus:ring-0"
                            value={row[colIdx] ?? ""}
                            disabled={editLoading === `${rowIdx}-${colIdx}`}
                            onChange={e => {
                              const newTableData = tableData.map((r: any[], i: number) =>
                                i === rowIdx ? r.map((cell: any, j: number) => (j === colIdx ? e.target.value : cell)) : r
                              )
                              setTableData(newTableData)
                            }}
                            onBlur={e => handleCellEdit(rowIdx, colIdx, e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") {
                                (e.target as HTMLInputElement).blur()
                              }
                            }}
                          />
                        )}
                      {editLoading === `${rowIdx}-${colIdx}` && (
                        <span className="ml-2 text-xs text-blue-500">Saving...</span>
                      )}
                    </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
          )}
      <div className="mt-12">
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-xl font-bold">Cost Management Data</h2>
      <div className="flex gap-2">
        <Button 
          onClick={saveCostDataToFirebase} 
          disabled={saveLoading || deleteLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {saveLoading ? "Saving..." : "Save"}
        </Button>
        <Button 
          onClick={deleteCostDataFromFirebase} 
          disabled={saveLoading || deleteLoading}
          className="bg-red-600 hover:bg-red-700 text-white"
        >
          {deleteLoading ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </div>
    {saveMessage && (
      <div className={`mb-4 p-3 rounded-md text-sm ${
        saveMessage.includes('Successfully') 
          ? 'bg-green-100 text-green-800 border border-green-300' 
          : saveMessage.includes('Failed')
          ? 'bg-red-100 text-red-800 border border-red-300'
          : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
      }`}>
        {saveMessage}
      </div>
    )}
    {deleteMessage && (
      <div className={`mb-4 p-3 rounded-md text-sm ${
        deleteMessage.includes('Successfully') 
          ? 'bg-green-100 text-green-800 border border-green-300' 
          : deleteMessage.includes('Failed')
          ? 'bg-red-100 text-red-800 border border-red-300'
          : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
      }`}>
        {deleteMessage}
      </div>
    )}
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Trade ID</th>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">FX Gain/Loss</th>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">P&L Calculated</th>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Cost Status</th>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Approval Status</th>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Booked Date</th>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Commission</th>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Brokerage</th>
            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">Document ID</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {editableCostData.map((item, index) => (
            <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              <td className="p-3">
                <EditableCell value={item.TradeID} rowIndex={index} field="TradeID" onChange={handleCostCellChange} />
              </td>
              <td className="p-3">
                <EditableCell value={item.FXGainLoss} rowIndex={index} field="FXGainLoss" type="number" className={safeParseFloat(item.FXGainLoss) < 0 ? "text-red-600" : "text-green-600"} onChange={handleCostCellChange} />
              </td>
              <td className="p-3">
                <EditableCell value={item.PnlCalculated} rowIndex={index} field="PnlCalculated" type="number" className={safeParseFloat(item.PnlCalculated) < 0 ? "text-red-600" : "text-green-600"} onChange={handleCostCellChange} />
              </td>
              <td className="p-3">
                <StatusDropdown value={item.CostAllocationStatus} rowIndex={index} field="CostAllocationStatus" options={["Failed", "Allocated", "Pending"]} onChange={handleCostCellChange} />
              </td>
              <td className="p-3">
                <StatusDropdown value={item.ExpenseApprovalStatus} rowIndex={index} field="ExpenseApprovalStatus" options={["Rejected", "Under Review", "Approved"]} onChange={handleCostCellChange} />
              </td>
              <td className="p-3">
                <EditableCell value={formatDate(item.CostBookedDate)} rowIndex={index} field="CostBookedDate" type="date" onChange={handleCostCellChange} />
              </td>
              <td className="p-3">
                <div className="text-right">{formatCurrency(item.CommissionAmount, item.CommissionCurrency)}</div>
              </td>
              <td className="p-3">
                <div className="text-right">{formatCurrency(item.BrokerageFee, item.BrokerageCurrency)}</div>
              </td>
              <td className="p-3">
                <div className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">
                  {item.assignedDocumentId || "-"}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
  <div className="flex items-center gap-4 mb-4">
        <Button className="mb-0" onClick={unifyData}>Unify Data</Button>
        <Button className="mb-0" onClick={uploadUnifiedToFirebase} disabled={uploading || unifiedData.length === 0}>
          {uploading ? "Uploading..." : "Upload to Firebase"}
        </Button>
        {uploadSuccess && <span className="text-green-600 text-sm ml-2">Upload successful!</span>}
      </div>
  {unifiedData.length > 0 && (
    <div className="overflow-x-auto">
      <h2 className="text-xl font-bold mb-4">Unified Data</h2>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            {unifiedHeaders.map(h => (
              <th key={h} className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300">
                <span>{h}</span>
                <button
                  onClick={() => deleteUnifiedColumn(h)}
                  className="ml-2 text-red-500 hover:text-red-700 text-xs font-bold"
                  title={`Delete column ${h}`}
                  type="button"
                >
                  ×
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {unifiedData.map((row, idx) => (
            <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
              {unifiedHeaders.map(h => (
                <td key={h} className="p-3">
                  {typeof row[h] === "object" && row[h] !== null && "seconds" in row[h] && "nanoseconds" in row[h]
                    ? new Date(row[h].seconds * 1000).toLocaleString()
                    : String(row[h])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )}
</div>
  )
}

