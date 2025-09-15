"use client"

import React, { useState, useCallback, useEffect, useMemo } from "react"
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Download,
  CreditCard,
  BarChart3,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Building2,
} from "lucide-react"
import { analyzeExcelData, mapExcelToTradeData, type ExcelAnalysis } from "@/lib/excel-processor"
import type { TradeData } from "@/lib/data-processor"
import * as XLSX from "xlsx"
import { FileX } from "lucide-react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts"
import ExcelUpload from "./excel-upload";
import { useFirebase } from "@/hooks/use-firebase";
import { useCommissionFirebase } from "@/hooks/use-commission-firebase";
import { commissionManagementOperations, tradeOperations } from "@/lib/firebase-operations";

type CommissionManagementProps = {}

export default function CommissionManagement({}: CommissionManagementProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "management" | "analytics">("upload")
  const [trades, setTrades] = useState<TradeData[]>([])
  const [rawData, setRawData] = useState<any[]>([])
  const [dataType, setDataType] = useState<"equity" | "fx">("equity")
  const [loading, setLoading] = useState(false)

  const handleDataLoaded = (data: TradeData[], rawDataInput: any[], detectedType: "equity" | "fx") => {
    console.log(`Commission Management received ${data.length} trades with type ${detectedType}`)
    setTrades(data)
    setRawData(rawDataInput)
    setDataType(detectedType)
    setActiveTab("management")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 border-l-2 border-white">
      {/* Salesforce-inspired Header */}
      <div className="bg-white dark:bg-gray-800 border-b-2 border-white shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-black rounded-xl">
                <DollarSign className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Commission Management</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  Optimize commission structures and analyze trading costs
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-6">
              {trades.length > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-bold text-black">{trades.length.toLocaleString()}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">{dataType.toUpperCase()} Trades Loaded</div>
                </div>
              )}
            </div>
          </div>

          {/* Salesforce-inspired Tab Navigation */}
          <div className="flex space-x-1 mt-8 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab("upload")}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === "upload"
                  ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>Data Upload</span>
            </button>
            <button
              onClick={() => setActiveTab("management")}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === "management"
                  ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>Commission Management</span>
            </button>
            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-6 py-3 rounded-lg text-sm font-medium transition-all duration-200 flex items-center space-x-2 ${
                activeTab === "analytics"
                  ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Analytics</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto">
        {activeTab === "upload" ? (
          <CommissionDataUpload onDataLoaded={handleDataLoaded} />
        ) : activeTab === "management" ? (
          <CommissionManagementContent trades={trades} dataType={dataType} />
        ) : (
          <CommissionAnalytics trades={trades} dataType={dataType} />
        )}
      </div>
    </div>
  )
}

// Data Upload Component with Salesforce styling
function CommissionDataUpload({
  onDataLoaded,
}: {
  onDataLoaded: (data: TradeData[], rawData: any[], dataType: "equity" | "fx") => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [analysis, setAnalysis] = useState<ExcelAnalysis | null>(null)
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<"upload" | "analyze" | "map" | "complete">("upload")
  const [rawData, setRawData] = useState<any[]>([])
  const [dataType, setDataType] = useState<"equity" | "fx">("equity")
  const [fieldMappingType, setFieldMappingType] = useState<"equity" | "fx">("equity")
  const [isDataFromFirebase, setIsDataFromFirebase] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showInfoModal, setShowInfoModal] = useState(false)
  const { commissions, loadCommissions, loadCommissionsByType, loading: firebaseLoading, createCommission } = useCommissionFirebase();

  // Utility function to convert Firestore Timestamps to strings
  const convertTimestamps = (obj: any): any => {
    if (obj === null || obj === undefined) return obj;
    
    if (typeof obj === 'object' && obj.seconds !== undefined && obj.nanoseconds !== undefined) {
      // This is a Firestore Timestamp
      return new Date(obj.seconds * 1000).toISOString();
    }
    
    if (Array.isArray(obj)) {
      return obj.map(convertTimestamps);
    }
    
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        converted[key] = convertTimestamps(value);
      }
      return converted;
    }
    
    return obj;
  };

  // Handler for sourcing data from Firebase
  const handleSourceFromFirebase = async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      
      if (dataType === "fx") {
        console.log("Loading FX data from unified_data collection...");
        // For FX, load from unified_data collection
        const allTrades = await tradeOperations.getAllTrades();
        console.log("Raw FX trades loaded:", allTrades.length);
        // Filter for FX trades or get all if no specific FX filter needed
        data = allTrades.map((t: any) => {
          const converted = convertTimestamps(t);
          return { ...converted, data_source: "fx" };
        });
      } else {
        console.log("Loading Equity data from commission_management collection...");
        // For equity, use the main commission_management collection
        data = await commissionManagementOperations.getCommissionsFromMainCollection();
        console.log("Raw equity data loaded:", data.length);
        
        // If main collection is empty, try the subcollection as fallback
        if (data.length === 0) {
          console.log("Main collection empty, trying equity subcollection as fallback...");
          data = await commissionManagementOperations.getCommissionsByType("equity");
          console.log("Equity subcollection data:", data.length);
        }
      }
      
      const commissionsWithType = data.map((t: any) => {
        const converted = convertTimestamps(t);
        return { ...converted, data_source: converted.data_type || dataType };
      });
      
      console.log("Final processed data:", commissionsWithType.length);
      
      // Check if we have any data
      if (commissionsWithType.length === 0) {
        setError(`No ${dataType.toUpperCase()} data found in Firebase collections. Please upload some data first.`);
        setLoading(false);
        return;
      }
      
      // Set up for field mapping instead of directly loading
      setRawData(commissionsWithType);
      
      // Create analysis from Firebase data (similar to Excel analysis)
      console.log("Firebase data loaded:", commissionsWithType.length, "records");
      console.log("Sample record:", commissionsWithType[0]);
      
      const headers = commissionsWithType.length > 0 ? Object.keys(commissionsWithType[0]) : [];
      console.log("Extracted headers:", headers);
      
      const analysisResult = {
        headers,
        rowCount: commissionsWithType.length,
        hasData: commissionsWithType.length > 0,
        sampleData: commissionsWithType.slice(0, 5) // First 5 rows as sample
      };
      setAnalysis(analysisResult);

      // Set field mapping type to match data type initially
      setFieldMappingType(dataType);
      
      // Mark that this data came from Firebase
      setIsDataFromFirebase(true);
      
      // Auto-map fields for Firebase data using flexible mapping
      const fields = dataType === "equity" ? equityFields : fxFields;
      const autoMapping = createFlexibleMapping(fields, headers);
      setFieldMapping(autoMapping);

      // Move to mapping step instead of directly processing
      setStep("map");
    } catch (error) {
      console.error("Error loading data from Firebase:", error);
      setError(`Error loading data from Firebase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  // When processing uploaded data, also save to Firestore in the appropriate subcollection
  const handleProcessData = async (parsedData: TradeData[], rawData: any[], detectedType: "equity" | "fx") => {
    for (const record of parsedData) {
      await createCommission({ ...record, data_source: detectedType }, detectedType);
    }
    // Convert any timestamps in the parsed data before passing to onDataLoaded
    const convertedData = parsedData.map(t => convertTimestamps({ ...t, data_source: detectedType }));
    onDataLoaded(convertedData as any, rawData, detectedType);
  };

  // Define field groups for both equity and FX trades
  const equityFields = [
    { key: "tradeId", label: "Trade ID", required: true },
    { key: "orderId", label: "Order ID", required: false },
    { key: "clientId", label: "Client ID", required: false },
    { key: "isin", label: "ISIN", required: false },
    { key: "symbol", label: "Symbol", required: false },
    { key: "tradeType", label: "Trade Type", required: false },
    { key: "quantity", label: "Quantity", required: false },
    { key: "price", label: "Price", required: false },
    { key: "tradeValue", label: "Trade Value", required: false },
    { key: "currency", label: "Currency", required: false },
    { key: "tradeDate", label: "Trade Date", required: false },
    { key: "settlementDate", label: "Settlement Date", required: false },
    { key: "settlementStatus", label: "Settlement Status", required: false },
    { key: "counterparty", label: "Counterparty", required: false },
    { key: "tradingVenue", label: "Trading Venue", required: false },
    { key: "traderName", label: "Trader Name", required: false },
    { key: "kycStatus", label: "KYC Status", required: false },
    { key: "referenceDataValidated", label: "Reference Data Validated", required: false },
    { key: "commission", label: "Commission", required: false },
    { key: "taxes", label: "Taxes", required: false },
    { key: "totalCost", label: "Total Cost", required: false },
    { key: "confirmationStatus", label: "Confirmation Status", required: false },
    { key: "countryOfTrade", label: "Country of Trade", required: false },
    { key: "opsTeamNotes", label: "Ops Team Notes", required: false },
    { key: "pricingSource", label: "Pricing Source", required: false },
    { key: "marketImpactCost", label: "Market Impact Cost", required: false },
    { key: "fxRateApplied", label: "FX Rate Applied", required: false },
    { key: "netAmount", label: "Net Amount", required: false },
    { key: "collateralRequired", label: "Collateral Required", required: false },
    { key: "marginType", label: "Margin Type", required: false },
    { key: "marginStatus", label: "Margin Status", required: false },
  ]

  const fxFields = [
    // Trade Identification & Basic Info
    { key: "tradeId", label: "TradeID", required: true },
    { key: "tradeDate", label: "TradeDate", required: false },
    { key: "valueDate", label: "ValueDate", required: false },
    { key: "tradeTime", label: "TradeTime", required: false },
    { key: "traderId", label: "TraderID", required: false },
    { key: "counterparty", label: "Counterparty", required: false },
    { key: "portfolio", label: "Portfolio", required: false },

    // Currency & Trade Details
    { key: "currencyPair", label: "CurrencyPair", required: false },
    { key: "buySell", label: "BuySell", required: false },
    { key: "dealtCurrency", label: "DealtCurrency", required: false },
    { key: "baseCurrency", label: "BaseCurrency", required: false },
    { key: "termCurrency", label: "TermCurrency", required: false },
    { key: "notionalAmount", label: "NotionalAmount", required: false },
    { key: "fxRate", label: "FXRate", required: false },
    { key: "productType", label: "ProductType", required: false },

    // Trade Status & Processing
    { key: "tradeStatus", label: "TradeStatus", required: false },
    { key: "settlementStatus", label: "SettlementStatus", required: false },
    { key: "settlementMethod", label: "SettlementMethod", required: false },
    { key: "tradeVersion", label: "TradeVersion", required: false },
    { key: "cancellationFlag", label: "CancellationFlag", required: false },
    { key: "amendmentFlag", label: "AmendmentFlag", required: false },
    { key: "confirmationStatus", label: "ConfirmationStatus", required: false },
    { key: "confirmationMethod", label: "ConfirmationMethod", required: false },
    { key: "confirmationTimestamp", label: "ConfirmationTimestamp", required: false },
    { key: "settlementDate", label: "SettlementDate", required: false },

    // Execution & Venue
    { key: "broker", label: "Broker", required: false },
    { key: "executionVenue", label: "ExecutionVenue", required: false },
    { key: "bookingLocation", label: "BookingLocation", required: false },
    { key: "maturityDate", label: "MaturityDate", required: false },

    // Risk & Compliance
    { key: "riskSystemId", label: "RiskSystemID", required: false },
    { key: "regulatoryReportingStatus", label: "RegulatoryReportingStatus", required: false },
    { key: "tradeComplianceStatus", label: "TradeComplianceStatus", required: false },
    { key: "kycCheck", label: "KYCCheck", required: false },
    { key: "sanctionsScreening", label: "SanctionsScreening", required: false },
    { key: "nettingEligibility", label: "NettingEligibility", required: false },
    { key: "exceptionFlag", label: "ExceptionFlag", required: false },
    { key: "exceptionNotes", label: "ExceptionNotes", required: false },
    { key: "auditTrailRef", label: "AuditTrailRef", required: false },

    // Operations & Settlement
    { key: "tradeSourceSystem", label: "TradeSourceSystem", required: false },
    { key: "settlementInstructions", label: "SettlementInstructions", required: false },
    { key: "custodian", label: "Custodian", required: false },
    { key: "costBookedDate", label: "CostBookedDate", required: false },

    // Fees & Costs
    { key: "commissionAmount", label: "CommissionAmount", required: false },
    { key: "commissionCurrency", label: "CommissionCurrency", required: false },
    { key: "brokerageFee", label: "BrokerageFee", required: false },
    { key: "brokerageCurrency", label: "BrokerageCurrency", required: false },
    { key: "custodyFee", label: "CustodyFee", required: false },
    { key: "custodyCurrency", label: "CustodyCurrency", required: false },
    { key: "settlementCost", label: "SettlementCost", required: false },
    { key: "settlementCurrency", label: "SettlementCurrency", required: false },
    { key: "fxGainLoss", label: "FXGainLoss", required: false },
    { key: "pnlCalculated", label: "PnlCalculated", required: false },
    { key: "costAllocationStatus", label: "CostAllocationStatus", required: false },
    { key: "costCenter", label: "CostCenter", required: false },
    { key: "expenseApprovalStatus", label: "ExpenseApprovalStatus", required: false },
  ]

  const tradeFields = fieldMappingType === "equity" ? equityFields : fxFields

  const handleFileUpload = useCallback(
    async (uploadedFile: File) => {
      setLoading(true)
      setError(null)
      try {
        const reader = new FileReader()

        reader.onload = async (event) => {
          try {
            const arrayBuffer = event.target?.result
            if (!arrayBuffer) {
              throw new Error("Failed to read file")
            }

            const workbook = XLSX.read(new Uint8Array(arrayBuffer as ArrayBuffer), { type: "array" })
            const firstSheetName = workbook.SheetNames[0]
            const worksheet = workbook.Sheets[firstSheetName]
            const data = XLSX.utils.sheet_to_json(worksheet)

            // Use the selected dataType instead of auto-detecting
            const analysisResult = analyzeExcelData(data)
            setFile(uploadedFile)
            setRawData(data)
            setAnalysis(analysisResult)

            // Set field mapping type to match selected data type initially
            setFieldMappingType(dataType);

            // Mark that this data came from file upload (not Firebase)
            setIsDataFromFirebase(false);

            const fields = dataType === "fx" ? fxFields : equityFields
            const autoMapping = createFlexibleMapping(fields, analysisResult.headers)
            setFieldMapping(autoMapping)

            setStep("map")
          } catch (error) {
            console.error("Error processing Excel data:", error)
            setError(`Error processing Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`)
          } finally {
            setLoading(false)
          }
        }

        reader.readAsArrayBuffer(uploadedFile)
      } catch (error) {
        console.error("Error handling file upload:", error)
        setError(`Error uploading file: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setLoading(false)
      }
    },
    [fxFields, equityFields],
  )



  const createExactMapping = (fields: { key: string; label: string; required: boolean }[], headers: string[]) => {
    const mapping: Record<string, string> = {}
    fields.forEach((field) => {
      if (headers.includes(field.label)) {
        mapping[field.key] = field.label
      }
    })
    return mapping
  }

  // Enhanced mapping that handles cross-type mapping (FX data -> Equity fields, etc.)
  const createFlexibleMapping = (fields: { key: string; label: string; required: boolean }[], headers: string[]) => {
    const mapping: Record<string, string> = {}
    
    // Create normalized header lookup (lowercase, remove spaces/underscores)
    const normalizeKey = (key: string) => key.toLowerCase().replace(/[_\s-]/g, '')
    const headerMap = headers.reduce((acc, header) => {
      acc[normalizeKey(header)] = header
      return acc
    }, {} as Record<string, string>)
    
    // Common field mappings between FX and Equity
    const crossTypeMapping: Record<string, string[]> = {
      // Trade identification
      'tradeId': ['tradeid', 'trade_id', 'tradeID', 'TradeID', 'id'],
      'orderId': ['orderid', 'order_id', 'orderID', 'OrderID'],
      'clientId': ['clientid', 'client_id', 'clientID', 'ClientID'],
      
      // Amounts and values
      'tradeValue': ['tradevalue', 'trade_value', 'notionalamount', 'notional_amount', 'amount', 'value'],
      'notionalAmount': ['notionalamount', 'notional_amount', 'tradevalue', 'trade_value', 'amount'],
      'price': ['price', 'rate', 'fxrate', 'fx_rate'],
      'fxRate': ['fxrate', 'fx_rate', 'rate', 'price'],
      
      // Currencies
      'currency': ['currency', 'ccy', 'dealedcurrency', 'basecurrency', 'termcurrency'],
      'baseCurrency': ['basecurrency', 'base_currency', 'currency', 'ccy'],
      'termCurrency': ['termcurrency', 'term_currency', 'currency', 'ccy'],
      'dealtCurrency': ['dealtcurrency', 'dealt_currency', 'currency', 'ccy'],
      
      // Dates
      'tradeDate': ['tradedate', 'trade_date', 'date', 'executiondate', 'valuedate'],
      'valueDate': ['valuedate', 'value_date', 'settlementdate', 'settlement_date'],
      'settlementDate': ['settlementdate', 'settlement_date', 'valuedate', 'value_date'],
      
      // Trade details
      'counterparty': ['counterparty', 'broker', 'client', 'party'],
      'tradingVenue': ['tradingvenue', 'trading_venue', 'venue', 'exchange', 'executionvenue'],
      'executionVenue': ['executionvenue', 'execution_venue', 'tradingvenue', 'trading_venue', 'venue'],
      
      // FX specific
      'currencyPair': ['currencypair', 'currency_pair', 'pair', 'symbol'],
      'buySell': ['buysell', 'buy_sell', 'side', 'direction', 'tradetype', 'trade_type'],
      
      // Equity specific  
      'symbol': ['symbol', 'ticker', 'instrument', 'isin', 'currencypair'],
      'isin': ['isin', 'symbol', 'ticker', 'instrument'],
      'quantity': ['quantity', 'qty', 'amount', 'notionalamount', 'volume'],
      
      // Status fields
      'tradeStatus': ['tradestatus', 'trade_status', 'status'],
      'settlementStatus': ['settlementstatus', 'settlement_status', 'status'],
      'confirmationStatus': ['confirmationstatus', 'confirmation_status', 'status'],
      
      // Fees and costs
      'commission': ['commission', 'commissionamount', 'commission_amount', 'fee'],
      'commissionAmount': ['commissionamount', 'commission_amount', 'commission', 'fee'],
      'brokerageFee': ['brokeragefee', 'brokerage_fee', 'brokerage', 'fee', 'commission'],
      'taxes': ['taxes', 'tax', 'fee'],
      'totalCost': ['totalcost', 'total_cost', 'cost', 'amount']
    }
    
    fields.forEach((field) => {
      // First try exact match
      if (headers.includes(field.label)) {
        mapping[field.key] = field.label
        return
      }
      
      // Then try flexible matching
      const possibleMatches = crossTypeMapping[field.key] || [field.key]
      possibleMatches.push(field.label.toLowerCase()) // Add the original field label
      
      for (const match of possibleMatches) {
        const normalizedMatch = normalizeKey(match)
        if (headerMap[normalizedMatch]) {
          mapping[field.key] = headerMap[normalizedMatch]
          break
        }
      }
    })
    
    return mapping
  }

  // Handler for field mapping type changes
  const handleFieldMappingTypeChange = (newType: "equity" | "fx") => {
    setFieldMappingType(newType);
    
    // Re-calculate auto-mapping with new field type using flexible mapping
    if (analysis) {
      const fields = newType === "equity" ? equityFields : fxFields;
      const autoMapping = createFlexibleMapping(fields, analysis.headers);
      setFieldMapping(autoMapping);
    }
  }

  // Handler for auto-mapping fields
  const handleAutoMapFields = () => {
    if (analysis) {
      const fields = fieldMappingType === "equity" ? equityFields : fxFields;
      const autoMapping = createFlexibleMapping(fields, analysis.headers);
      setFieldMapping(autoMapping);
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const droppedFile = e.dataTransfer.files[0]
        if (
          droppedFile.name.endsWith(".xlsx") ||
          droppedFile.name.endsWith(".xls") ||
          droppedFile.name.endsWith(".csv")
        ) {
          handleFileUpload(droppedFile)
        } else {
          setError("Please upload an Excel or CSV file (.xlsx, .xls, .csv)")
        }
      }
    },
    [handleFileUpload],
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0]
      if (selectedFile) {
        handleFileUpload(selectedFile)
      }
    },
    [handleFileUpload],
  )

  const processData = () => {
    if (!rawData.length || Object.keys(fieldMapping).length === 0) {
      setError("No data to process or field mapping missing")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const mappedData = mapExcelToTradeData(rawData, fieldMapping)
      const dataWithSource = mappedData.map((trade) => ({
        ...trade,
        dataSource: dataType,
      }))

      if (isDataFromFirebase) {
        // Data is from Firebase - just process and show in Commission Management
        console.log("Processing Firebase data for display (no upload to Firebase)");
        onDataLoaded(dataWithSource, rawData, dataType);
      } else {
        // Data is from file upload - upload to Firebase then show
        console.log("Processing file upload data (will upload to Firebase)");
        handleProcessData(dataWithSource, rawData, dataType);
        setStep("complete");
      }
    } catch (error) {
      console.error("Error processing data:", error)
      setError(`Error processing data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  // Handler to upload raw data as-is to Firebase (original Excel columns, no field mapping)
  const uploadAsIsToFirebase = async () => {
    if (!rawData.length) {
      setError("No data to upload")
      return
    }

    setLoading(true)
    setError(null)
    try {
      console.log("Uploading raw data as-is (no field mapping applied):", rawData.length, "records");
      console.log("Sample raw record:", rawData[0]);
      
      // Upload each record exactly as it came from Excel/CSV (no field mapping)
      for (const record of rawData) {
        const rawRecordWithMetadata = {
          ...record, // Keep all original Excel column names exactly as they are
          data_source: dataType,
          uploaded_as_is: true,
          upload_timestamp: new Date().toISOString(),
          original_file_name: file?.name || 'firebase_source'
        };
        
        if (dataType === "fx") {
          // For FX data, upload to unified_data collection
          // Add a unique trade_id if not present in any variation
          if (!record.trade_id && !record.tradeId && !record.TradeID && !record.TradeId) {
            rawRecordWithMetadata.trade_id = `fx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          }
          await tradeOperations.createTrade(rawRecordWithMetadata);
        } else {
          // For equity data, upload to commission management collection  
          await createCommission(rawRecordWithMetadata, dataType);
        }
      }
      
      alert(`Successfully uploaded ${rawData.length} records as-is to Firebase with original column names preserved!`);
      setStep("complete")
    } catch (error) {
      console.error("Error uploading raw data as-is:", error)
      setError(`Error uploading raw data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadTemplate = () => {
    if (dataType === "equity") {
      const templateData = [
        {
          "Trade ID": "TID001",
          "Order ID": "OID001",
          "Client ID": "CLIENT001",
          Symbol: "AAPL",
          "Trade Type": "Buy",
          Quantity: 100,
          Price: 150.5,
          "Trade Value": 15050,
          Currency: "USD",
          "Trade Date": "2024-01-15",
          "Settlement Date": "2024-01-17",
          Counterparty: "Goldman Sachs",
          "Trading Venue": "NASDAQ",
          Commission: 15.05,
          Taxes: 30.1,
          "Total Cost": 15095.15,
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Equity Commission Template")
      XLSX.writeFile(wb, "equity_commission_template.xlsx")
    } else {
      const templateData = [
        {
          TradeID: "FX001",
          TradeDate: "2024-01-15",
          ValueDate: "2024-01-17",
          TradeTime: "09:30:00",
          TraderID: "TDR001",
          Counterparty: "JPMorgan",
          Portfolio: "PORT1",
          CurrencyPair: "EUR/USD",
          BuySell: "Buy",
          DealtCurrency: "EUR",
          BaseCurrency: "EUR",
          TermCurrency: "USD",
          NotionalAmount: 1000000,
          FXRate: 1.0875,
          ProductType: "Spot",
          TradeStatus: "Confirmed",
          SettlementStatus: "Pending",
          SettlementMethod: "CLS",
          Broker: "Prime Broker",
          ExecutionVenue: "360T",
          CommissionAmount: 100,
          CommissionCurrency: "USD",
        },
      ]

      const ws = XLSX.utils.json_to_sheet(templateData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "FX Commission Template")
      XLSX.writeFile(wb, "fx_commission_template.xlsx")
    }
  }

  if (step === "upload") {
    return (
      <div className="p-8 bg-white dark:bg-gray-800 rounded-lg shadow-md mt-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Upload or Source Commission Data</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowInfoModal(true)}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors"
              title="Show instructions"
            >
              i
            </button>
            <button
              onClick={handleSourceFromFirebase}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium"
              disabled={firebaseLoading}
            >
              {firebaseLoading ? "Loading..." : "Next"}
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto">
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-xl p-6 mb-8">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
                <p className="text-red-800 dark:text-red-200 font-medium">{error}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-12">
            {/* Upload Area */}
            <div className="space-y-8">
              <div className="flex justify-center">
                <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                  <button
                    onClick={() => setDataType("equity")}
                    className={`px-6 py-3 rounded-lg flex items-center space-x-3 font-medium transition-all duration-200 ${
                      dataType === "equity"
                        ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <BarChart3 className="h-5 w-5" />
                    <span>Equity Trades</span>
                  </button>
                  <button
                    onClick={() => setDataType("fx")}
                    className={`px-6 py-3 rounded-lg flex items-center space-x-3 font-medium transition-all duration-200 ${
                      dataType === "fx"
                        ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    <CreditCard className="h-5 w-5" />
                    <span>FX Trades</span>
                  </button>
                </div>
              </div>

              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="card-bw p-12 text-center hover:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 cursor-pointer"
              >
                <div className="p-4 bg-gray-100 dark:bg-sf-blue-900 rounded-full w-fit mx-auto mb-6">
                  <FileSpreadsheet size={48} className="text-black dark:text-sf-blue-400" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6">Drop files here</h3>
                <div className="flex justify-center">
                  <label className="btn-primary cursor-pointer inline-flex items-center space-x-2">
                    <Upload size={20} />
                    <span>Browse Files</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={loading}
                    />
                  </label>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={downloadTemplate}
                  className="text-black dark:text-sf-blue-400 hover:text-sf-blue-700 dark:hover:text-sf-blue-300 flex items-center space-x-2 font-medium"
                >
                  <Download size={16} />
                  <span>Download Template</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Instructions</h3>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium text-red-600">Equity trades are not loaded</span>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <span className="font-medium text-green-600">FX trades are available</span>
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  Please click on <span className="font-medium">"FX Trades"</span> button, then click <span className="font-medium text-green-600">"Next"</span> to load data.
                </p>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (step === "map") {
    return (
      <div className="p-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Field Mapping</h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              Data Source: {dataType.toUpperCase()} → Field Mapping: {fieldMappingType.toUpperCase()} ({tradeFields.length} fields)
            </p>
            
            {/* Field Mapping Type Selector */}
            <div className="flex justify-center mb-6">
              <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
                <button
                  onClick={() => handleFieldMappingTypeChange("equity")}
                  className={`px-6 py-3 rounded-lg flex items-center space-x-3 font-medium transition-all duration-200 ${
                    fieldMappingType === "equity"
                      ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <BarChart3 className="h-5 w-5" />
                  <span>Map as Equity Fields</span>
                </button>
                <button
                  onClick={() => handleFieldMappingTypeChange("fx")}
                  className={`px-6 py-3 rounded-lg flex items-center space-x-3 font-medium transition-all duration-200 ${
                    fieldMappingType === "fx"
                      ? "bg-white dark:bg-gray-600 text-black dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400"
                  }`}
                >
                  <CreditCard className="h-5 w-5" />
                  <span>Map as FX Fields</span>
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded-xl p-6 mb-8">
              <div className="flex items-center">
                <AlertCircle className="h-6 w-6 text-red-500 mr-3" />
                <p className="text-red-800 dark:text-red-200 font-medium">{error}</p>
              </div>
            </div>
          )}

          <div className="card-bw p-8 mb-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Field Mapping</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {Object.keys(fieldMapping).length} of {tradeFields.length} fields mapped
                  {Object.keys(fieldMapping).length > 0 && (
                    <span className="ml-2 text-green-600 dark:text-green-400">
                      ({Math.round((Object.keys(fieldMapping).length / tradeFields.length) * 100)}% auto-mapped)
                    </span>
                  )}
                </p>
              </div>
              <div className="flex space-x-3">
                <button 
                  onClick={handleAutoMapFields} 
                  className="btn-primary flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Auto-map Fields</span>
                </button>
                <button onClick={() => {
                  // Reset state when going back to upload
                  setIsDataFromFirebase(false);
                  setStep("upload");
                }} className="btn-secondary">
                  Back to Upload
                </button>
              </div>
            </div>

            <div className="overflow-auto max-h-96 rounded-lg border border-gray-200 dark:border-gray-600">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Commission Field
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Excel Column
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                      Required
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-gray-200 dark:divide-gray-700">
                  {tradeFields.map((field) => (
                    <tr key={field.key} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-gray-100">{field.label}</td>
                      <td className="px-6 py-4">
                        <select
                          value={fieldMapping[field.key] || ""}
                          onChange={(e) => setFieldMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          className="w-full text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-black focus:border-black"
                        >
                          <option value="">-- Select Column --</option>
                          {analysis?.headers.map((header) => (
                            <option key={header} value={header}>
                              {header}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {field.required ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            Required
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                            Optional
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end space-x-4">
            <button
              onClick={uploadAsIsToFirebase}
              disabled={loading}
              className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Uploading..." : "Upload as is to Firebase"}
            </button>
            <button
              onClick={processData}
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Processing Data..." : "Process Data"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === "complete") {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full w-fit mx-auto mb-8">
            <CheckCircle size={64} className="text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Processing Complete</h2>
          <div className="card-bw p-8 mb-8">
            <div className="text-4xl font-bold text-black mb-2">{rawData.length.toLocaleString()}</div>
            <div className="text-gray-600 dark:text-gray-400">Records processed</div>
          </div>
          <div className="flex justify-center space-x-4">
            <button
              onClick={() => {
                setIsDataFromFirebase(false);
                setStep("upload");
              }}
              className="btn-primary"
            >
              Upload More Data
            </button>
            <button
              onClick={() => {
                setStep("upload");
                setIsDataFromFirebase(false);
                setError(null);
                setFile(null);
                setAnalysis(null);
                setFieldMapping({});
                setRawData([]);
              }}
              className="btn-secondary"
            >
              Back to Upload
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Commission Management Content Component
function CommissionManagementContent({
  trades,
  dataType,
}: {
  trades: TradeData[]
  dataType: "equity" | "fx"
}) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [availableColumns, setAvailableColumns] = useState<string[]>([])
  const [tableData, setTableData] = useState<any[]>([])
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>("")

  // Add pagination state
  const [currentPage, setCurrentPage] = useState<string>("1-50")
  const [pageOptions] = useState([
    { value: "1-50", label: "1-50", start: 0, end: 50 },
    { value: "51-100", label: "51-100", start: 50, end: 100 },
    { value: "101-150", label: "101-150", start: 100, end: 150 },
    { value: "151-200", label: "151-200", start: 150, end: 200 },
  ])

  // Extract available columns from the raw data
  useEffect(() => {
    if (trades.length > 0) {
      const firstTrade = trades[0] as any
      const columns = Object.keys(firstTrade).filter(
        (key) => key !== "dataSource" && firstTrade[key] !== undefined && firstTrade[key] !== null,
      )
      setAvailableColumns(columns)

      // Set default selection (first 9 columns)
      const defaultColumns = columns.slice(0, 9)
      setSelectedColumns(defaultColumns)
    }
  }, [trades])

  // Update table data when columns change
  useEffect(() => {
    if (trades.length > 0 && selectedColumns.length > 0) {
      const data = trades.map((trade) => {
        const row: any = {}
        selectedColumns.forEach((col) => {
          row[col] = (trade as any)[col] || ""
        })
        return row
      })
      setTableData(data)
    }
  }, [trades, selectedColumns])

  const handleColumnChange = (column: string, isSelected: boolean) => {
    if (isSelected && selectedColumns.length < 9) {
      setSelectedColumns([...selectedColumns, column])
    } else if (!isSelected) {
      setSelectedColumns(selectedColumns.filter((col) => col !== column))
    }
  }

  const clearAllColumns = () => {
    setSelectedColumns([])
  }

  const selectDefaultColumns = () => {
    const defaultColumns = availableColumns.slice(0, 9)
    setSelectedColumns(defaultColumns)
  }

  // Filter columns based on search query
  const filteredColumns = availableColumns.filter(column =>
    column.toLowerCase().includes(columnSearchQuery.toLowerCase())
  )

  // Helper function to format cell values
  const renderCellValue = (value: any) => {
    if (value === null || value === undefined || value === "") return "-"
    if (typeof value === "object" && value.seconds) {
      // Handle Firestore timestamp
      return new Date(value.seconds * 1000).toLocaleDateString()
    }
    if (typeof value === "number") {
      return value.toLocaleString()
    }
    return String(value)
  }

  if (trades.length === 0) {
    return (
      <div className="p-8">
        <div className="card-bw p-12 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
            <Building2 className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">No Data</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Column Selection */}
      <div className="card-bw p-8">
        <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Column Selection</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Select up to 9 columns to display ({selectedColumns.length}/9 selected) - {dataType.toUpperCase()} Dataset:{" "}
          {availableColumns.length} columns available
        </p>

        {/* Control Buttons and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex space-x-4">
            <button onClick={clearAllColumns} className="btn-secondary">
              Clear All
            </button>
            <button onClick={selectDefaultColumns} className="btn-primary">
              Select Default (First 9)
            </button>
          </div>
          <div className="flex-1 max-w-md">
            <div className="relative">
              <input
                type="text"
                placeholder="Search columns..."
                value={columnSearchQuery}
                onChange={(e) => setColumnSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-black focus:border-black placeholder-gray-500 dark:placeholder-gray-400"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              {columnSearchQuery && (
                <button
                  onClick={() => setColumnSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {columnSearchQuery && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Showing {filteredColumns.length} of {availableColumns.length} columns
              </p>
            )}
          </div>
        </div>

        {/* Column Selection Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredColumns.map((column) => {
            const isSelected = selectedColumns.includes(column)
            const canSelect = selectedColumns.length < 9 || isSelected

            return (
              <label
                key={column}
                className={`flex items-center space-x-3 p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                  isSelected
                    ? "bg-gray-50 dark:bg-sf-blue-900 border-gray-200 dark:border-sf-blue-700"
                    : canSelect
                      ? "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                      : "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 opacity-50 cursor-not-allowed"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => handleColumnChange(column, e.target.checked)}
                  disabled={!canSelect}
                  className="rounded border-gray-300 text-black focus:ring-black"
                />
                <span
                  className={`text-sm font-medium ${
                    isSelected ? "text-black dark:text-sf-blue-200" : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {column}
                </span>
              </label>
            )
          })}
        </div>

        {/* No results message */}
        {columnSearchQuery && filteredColumns.length === 0 && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">
              No columns found matching "{columnSearchQuery}"
            </p>
          </div>
        )}
      </div>

      {/* Data Table */}
      {selectedColumns.length > 0 && (
        <div className="card-bw overflow-hidden">
          <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white">Commission Data Table</h3>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {tableData.length.toLocaleString()} records with {selectedColumns.length} selected columns
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show rows:</label>
                <select
                  value={currentPage}
                  onChange={(e) => setCurrentPage(e.target.value)}
                  className="text-sm rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-black focus:border-black"
                >
                  {pageOptions.map((option) => (
                    <option key={option.value} value={option.value} disabled={tableData.length <= option.start}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {selectedColumns.map((column) => (
                    <th
                      key={column}
                      className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600 last:border-r-0"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-gray-200 dark:divide-gray-700">
                {(() => {
                  const currentOption = pageOptions.find((option) => option.value === currentPage)
                  const startIndex = currentOption?.start || 0
                  const endIndex = currentOption?.end || 50
                  const paginatedData = tableData.slice(startIndex, endIndex)

                  return paginatedData.map((row, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      {selectedColumns.map((column) => (
                        <td
                          key={column}
                          className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600 last:border-r-0"
                        >
                          {renderCellValue(row[column])}
                        </td>
                      ))}
                    </tr>
                  ))
                })()}
              </tbody>
            </table>
          </div>

          {tableData.length > 50 && (
            <div className="px-8 py-4 bg-gray-50 dark:bg-gray-700 text-center border-t border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Showing rows {(() => {
                  const currentOption = pageOptions.find((option) => option.value === currentPage)
                  const startIndex = (currentOption?.start || 0) + 1
                  const endIndex = Math.min(currentOption?.end || 50, tableData.length)
                  return `${startIndex}-${endIndex}`
                })()} of {tableData.length.toLocaleString()} total records
              </p>
            </div>
          )}
        </div>
      )}

      {selectedColumns.length === 0 && (
        <div className="card-bw p-12 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
            <BarChart3 className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">Select Columns</h3>
        </div>
      )}
    </div>
  )
}

// Commission Analytics Component with KPI and KRI tabs
function CommissionAnalytics({
  trades,
  dataType,
}: {
  trades: TradeData[]
  dataType: "equity" | "fx"
}) {
  const [activeTab, setActiveTab] = useState<"kpi" | "kri">("kpi")
  const [kpis, setKpis] = useState<any>({})
  const [kris, setKris] = useState<any>({})

  const COLORS = [
    "#1f77b4",
    "#ff7f0e",
    "#2ca02c",
    "#d62728",
    "#9467bd",
    "#8c564b",
    "#e377c2",
    "#7f7f7f",
    "#bcbd22",
    "#17becf",
  ]

  // Helper component for KPI/KRI cards
  const InfoCard = ({ title, value, description, isRisk = false, icon }: any) => (
    <div
      className={`p-4 rounded-xl shadow-sm transition-all duration-200 hover:shadow-md ${isRisk ? "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800" : "bg-gray-50 dark:bg-sf-blue-900/20 border border-gray-200 dark:border-sf-blue-800"}`}
    >
      <div className="flex items-center">
        <div
          className={`p-2 rounded-full mr-3 ${isRisk ? "bg-red-200 dark:bg-red-800" : "bg-sf-blue-200 dark:bg-sf-blue-800"}`}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3
            className={`text-sm font-medium ${isRisk ? "text-red-800 dark:text-red-200" : "text-black dark:text-sf-blue-200"}`}
          >
            {title}
          </h3>
          <div
            className={`w-full h-px my-1 ${isRisk ? "bg-red-300 dark:bg-red-700" : "bg-sf-blue-300 dark:bg-sf-blue-700"}`}
          ></div>
          <p
            className={`text-xl font-bold ${isRisk ? "text-red-600 dark:text-red-400" : "text-black dark:text-sf-blue-400"}`}
          >
            {value}
          </p>
        </div>
      </div>
      <p className="text-gray-600 dark:text-gray-400 text-xs mt-2">{description}</p>
    </div>
  )

  // Icons for InfoCards
  const Icons = {
    TotalFees: () => <DollarSign className="h-4 w-4" />,
    AvgFee: () => <TrendingUp className="h-4 w-4" />,
    Commission: () => <CreditCard className="h-4 w-4" />,
    CostPercent: () => <BarChart3 className="h-4 w-4" />,
    CostOverrun: () => <AlertTriangle className="h-4 w-4 text-red-600" />,
    Unallocated: () => <AlertCircle className="h-4 w-4 text-red-600" />,
    IncompleteData: () => <FileX className="h-4 w-4 text-red-600" />,
  }

  useEffect(() => {
    if (trades.length > 0) {
      console.log("Processing trades data for analytics:", trades.length, "trades")
      console.log("Sample trade data:", trades[0])

      // Helper function to safely extract numeric values
      const getNumericValue = (trade: any, fields: string[]): number => {
        for (const field of fields) {
          const value = trade[field]
          if (value !== undefined && value !== null && value !== "") {
            const numValue = typeof value === "string" ? Number.parseFloat(value.replace(/[,$]/g, "")) : Number(value)
            if (!isNaN(numValue)) return numValue
          }
        }
        return 0
      }

      // Helper function to safely extract string values
      const getStringValue = (trade: any, fields: string[]): string => {
        for (const field of fields) {
          const value = trade[field]
          if (value && typeof value === "string" && value.trim() !== "") {
            return value.trim()
          }
        }
        return "Unknown"
      }

      // Helper function to parse dates
      const parseTradeDate = (trade: any): Date => {
        const dateFields = ["tradeDate", "date", "valueDate", "executionDate"]
        for (const field of dateFields) {
          const dateValue = trade[field]
          if (dateValue) {
            const parsed = new Date(dateValue)
            if (!isNaN(parsed.getTime())) return parsed
          }
        }
        return new Date() // fallback to current date
      }

      // KPI Calculations with improved field detection
      const totalCommissionFees = trades.reduce((sum, trade) => {
        const commission = getNumericValue(trade, [
          "commission",
          "commissionAmount",
          "commissionAmt",
          "Commission",
          "CommissionAmount",
        ])
        return sum + commission
      }, 0)

      const avgCommissionFeePerTrade = trades.length > 0 ? totalCommissionFees / trades.length : 0

      const totalBrokeragePaid = trades.reduce((sum, trade) => {
        const brokerage = getNumericValue(trade, ["brokerageFee", "brokerage", "BrokerageFee", "brokerageAmount"])
        return sum + brokerage
      }, 0)

      const totalNotionalAmt = trades.reduce((sum, trade) => {
        const notional = getNumericValue(trade, [
          "notionalAmount",
          "tradeValue",
          "notional",
          "NotionalAmount",
          "TradeValue",
          "amount",
        ])
        return sum + notional
      }, 0)

      const commissionCostAsPercentOfTradeNotional =
        totalNotionalAmt > 0 ? (totalCommissionFees / totalNotionalAmt) * 100 : 0

      // Group by broker/counterparty with improved field detection
      const tradesPerBroker = trades.reduce(
        (acc, trade) => {
          const broker = getStringValue(trade, [
            "counterparty",
            "broker",
            "Counterparty",
            "Broker",
            "executionVenue",
            "tradingVenue",
          ])
          acc[broker] = (acc[broker] || 0) + 1
          return acc
        },
        {} as Record<string, number>,
      )

      const brokerExpense = trades.reduce(
        (acc, trade) => {
          const broker = getStringValue(trade, [
            "counterparty",
            "broker",
            "Counterparty",
            "Broker",
            "executionVenue",
            "tradingVenue",
          ])
          if (!acc[broker]) {
            acc[broker] = { commissionFee: 0, brokerageFee: 0, settlementCost: 0 }
          }
          acc[broker].commissionFee += getNumericValue(trade, [
            "commission", 
            "commissionAmount", 
            "commissionAmt", 
            "Commission", 
            "CommissionAmount",
            "Commission Amount",
            "commission_amount",
            "totalCommission",
            "commissionFee"
          ])
          acc[broker].brokerageFee += getNumericValue(trade, [
            "brokerageFee", 
            "brokerage", 
            "brokerageAmount",
            "BrokerageFee",
            "Brokerage",
            "BrokerageAmount", 
            "Brokerage Fee",
            "brokerage_fee",
            "brokerFee",
            "BrokerFee"
          ])
          acc[broker].settlementCost += getNumericValue(trade, [
            "settlementCost", 
            "settlement", 
            "SettlementCost",
            "Settlement Cost",
            "settlement_cost",
            "SettlementFee",
            "settlementFee",
            "Settlement Fee"
          ])
          return acc
        },
        {} as Record<string, any>,
      )

      const brokerExpenseData = Object.keys(brokerExpense)
        .map((broker: string) => ({
          broker: broker.length > 15 ? broker.substring(0, 15) + "..." : broker,
          commissionFee: brokerExpense[broker].commissionFee,
          brokerageFee: brokerExpense[broker].brokerageFee,
          settlementCost: brokerExpense[broker].settlementCost,
          totalExpense:
            brokerExpense[broker].commissionFee +
            brokerExpense[broker].brokerageFee +
            brokerExpense[broker].settlementCost,
        }))
        .sort((a: any, b: any) => b.totalExpense - a.totalExpense) // Sort by total expense
        .slice(0, 10) // Top 10 brokers

      // Monthly trends for May and June only - by broker
      const mayJuneBrokerFees = trades.reduce(
        (acc, trade) => {
          const date = parseTradeDate(trade)
          const month = date.toLocaleString("default", { month: "short", year: "numeric" })

          // Only process May and June data
          if (!month.includes("May") && !month.includes("Jun")) {
            return acc
          }

          const broker = getStringValue(trade, [
            "counterparty",
            "broker",
            "Counterparty",
            "Broker",
            "executionVenue",
            "tradingVenue",
          ])

          const shortBroker = broker.length > 12 ? broker.substring(0, 12) + "..." : broker
          const key = `${shortBroker}_${month}`

          if (!acc[key]) {
            acc[key] = {
              broker: shortBroker,
              month: month,
              commissionFee: 0,
              brokerageFee: 0,
            }
          }

          acc[key].commissionFee += getNumericValue(trade, ["commission", "commissionAmount", "commissionAmt"])
          acc[key].brokerageFee += getNumericValue(trade, ["brokerageFee", "brokerage", "brokerageAmount"])

          return acc
        },
        {} as Record<string, any>,
      )

      // Convert to array and group by broker for chart display
      const brokerMonthlyData = Object.values(mayJuneBrokerFees).reduce((acc, item: any) => {
        const existingBroker = acc.find((b: any) => b.broker === item.broker)
        if (existingBroker) {
          if (item.month.includes("May")) {
            existingBroker.mayCommission = item.commissionFee
            existingBroker.mayBrokerage = item.brokerageFee
          } else if (item.month.includes("Jun")) {
            existingBroker.junCommission = item.commissionFee
            existingBroker.junBrokerage = item.brokerageFee
          }
        } else {
          const newBroker: any = {
            broker: item.broker,
            mayCommission: 0,
            mayBrokerage: 0,
            junCommission: 0,
            junBrokerage: 0,
          }
          if (item.month.includes("May")) {
            newBroker.mayCommission = item.commissionFee
            newBroker.mayBrokerage = item.brokerageFee
          } else if (item.month.includes("Jun")) {
            newBroker.junCommission = item.commissionFee
            newBroker.junBrokerage = item.brokerageFee
          }
          acc.push(newBroker)
        }
        return acc
      }, [] as any[])

      // Sort by total fees and take top 8 brokers
      const feesOverTimeData = brokerMonthlyData
        .map((broker: any) => ({
          ...broker,
          totalFees: broker.mayCommission + broker.mayBrokerage + broker.junCommission + broker.junBrokerage,
        }))
        .sort((a: any, b: any) => b.totalFees - a.totalFees)
        .slice(0, 8)

      console.log("KPI Calculations:", {
        totalCommissionFees,
        avgCommissionFeePerTrade,
        totalBrokeragePaid,
        commissionCostAsPercentOfTradeNotional,
        brokerCount: Object.keys(tradesPerBroker).length,
        monthlyDataPoints: feesOverTimeData.length,
      })

      setKpis({
        totalCommissionFees,
        avgCommissionFeePerTrade,
        totalBrokeragePaid,
        commissionCostAsPercentOfTradeNotional,
        tradesPerBroker: Object.entries(tradesPerBroker)
          .map(([broker, count]: [string, number]) => ({
            broker: broker.length > 12 ? broker.substring(0, 12) + "..." : broker,
            count,
          }))
          .sort((a: any, b: any) => b.count - a.count)
          .slice(0, 8), // Top 8 brokers for better chart readability
        brokerExpenseData,
        feesOverTimeData,
      })

      // KRI Calculations with improved field detection
      const expectedCommissionFeeBenchmark = 100
      const commissionCostOverruns = trades.filter((trade) => {
        const commission = getNumericValue(trade, ["commission", "commissionAmount", "commissionAmt"])
        return commission > expectedCommissionFeeBenchmark
      }).length

      const unallocatedCosts = trades.filter((trade) => {
        const allocationStatus = getStringValue(trade, ["costAllocationStatus", "allocationStatus", "settlementStatus"])
        return !["Completed", "Allocated", "Settled"].includes(allocationStatus)
      }).length

      const percentageUnallocatedCosts = trades.length > 0 ? (unallocatedCosts / trades.length) * 100 : 0

      const missingOrIncompleteData = trades.filter((trade) => {
        const hasCommission = getNumericValue(trade, ["commission", "commissionAmount", "commissionAmt"]) > 0
        const hasBroker = getStringValue(trade, ["counterparty", "broker", "Counterparty", "Broker"]) !== "Unknown"
        const hasNotional = getNumericValue(trade, ["notionalAmount", "tradeValue", "notional", "amount"]) > 0
        return !hasCommission || !hasBroker || !hasNotional
      }).length

      const kriRadarData = [
        {
          subject: "Cost Overruns",
          A: trades.length > 0 ? (commissionCostOverruns / trades.length) * 100 : 0,
          fullMark: 100,
        },
        {
          subject: "Unallocated",
          A: percentageUnallocatedCosts,
          fullMark: 100,
        },
        {
          subject: "Incomplete Data",
          A: trades.length > 0 ? (missingOrIncompleteData / trades.length) * 100 : 0,
          fullMark: 100,
        },
      ]

      console.log("KRI Calculations:", {
        commissionCostOverruns,
        unallocatedCosts,
        percentageUnallocatedCosts,
        missingOrIncompleteData,
      })

      setKris({
        commissionCostOverruns,
        unallocatedCosts,
        percentageUnallocatedCosts,
        missingOrIncompleteData,
        expectedCommissionFeeBenchmark,
        kriRadarData,
      })
    } else {
      console.log("No trades data available for analytics")
      // Reset state when no data
      setKpis({})
      setKris({})
    }
  }, [trades])
  process.env.NODE_ENV === "development" && (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
      <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">Debug Info:</h4>
      <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
        <div>Total Trades: {trades.length}</div>
        <div>Data Type: {dataType}</div>
        {trades.length > 0 && (
          <>
            <div>Sample Fields: {Object.keys(trades[0]).slice(0, 5).join(", ")}...</div>
            <div>KPI Data Points: {kpis.feesOverTimeData?.length || 0} months</div>
            <div>Broker Count: {kpis.tradesPerBroker?.length || 0}</div>
            <div>Total Commission: ${kpis.totalCommissionFees?.toLocaleString() || 0}</div>
          </>
        )}
      </div>
    </div>
  )

  if (trades.length === 0) {
    return (
      <div className="p-8">
        <div className="card-bw p-12 text-center">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-6">
            <TrendingUp className="h-16 w-16 text-gray-400" />
          </div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">No Data Available</h3>
          <p className="text-gray-600 dark:text-gray-400">
            Please upload commission data to view analytics and insights
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Commission Analytics</h2>
        <p className="text-gray-600 dark:text-gray-400">Performance & Risk Analysis Dashboard</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("kpi")}
            className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors ${
              activeTab === "kpi"
                ? "border-black text-black dark:text-sf-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-400"
            }`}
          >
            Key Performance Indicators
          </button>
          <button
            onClick={() => setActiveTab("kri")}
            className={`py-4 px-1 border-b-2 font-medium text-lg transition-colors ${
              activeTab === "kri"
                ? "border-black text-black dark:text-sf-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-400"
            }`}
          >
            Key Risk Indicators
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "kpi" && (
        <div className="space-y-8">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <InfoCard
              title="Total Commission Fees"
              value={`$${kpis.totalCommissionFees?.toLocaleString() || "N/A"}`}
              description="Sum of all commission fees paid."
              icon={<Icons.TotalFees />}
            />
            <InfoCard
              title="Avg Fee Per Trade"
              value={`$${kpis.avgCommissionFeePerTrade?.toFixed(2) || "N/A"}`}
              description="Average commission cost per trade."
              icon={<Icons.AvgFee />}
            />
            <InfoCard
              title="Total Brokerage"
              value={`$${kpis.totalBrokeragePaid?.toLocaleString() || "N/A"}`}
              description="Sum of all brokerage fees paid."
              icon={<Icons.Commission />}
            />
            <InfoCard
              title="Cost as % of Notional"
              value={`${kpis.commissionCostAsPercentOfTradeNotional?.toFixed(2) || "N/A"}%`}
              description="Commission fees vs. total trade value."
              icon={<Icons.CostPercent />}
            />
          </div>

          {/* Charts */}
          <div className="space-y-8">
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Trades per Counterparty</h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpis.tradesPerBroker} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="broker" type="category" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(value) => `${value} trades`} />
                    <Bar dataKey="count" name="Trades" fill="#3b82f6">
                      {kpis.tradesPerBroker?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="card-bw p-6">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Counterparty Total Expense Breakdown
            </h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.brokerExpenseData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="broker" />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [`$${value.toLocaleString()}`, "Total Expense"]}
                    labelFormatter={(label) => `Broker: ${label}`}
                  />
                  <Legend />
                  <Bar
                    dataKey="totalExpense"
                    fill="#3b82f6"
                    name="Total Expense (Commission + Brokerage + Settlement)"
                    radius={[4, 4, 0, 0]}
                  >
                    {kpis.brokerExpenseData?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Add a breakdown table below the chart */}
            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-900 dark:text-gray-100">Counterparty</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">Commission</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">Brokerage</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">Settlement</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-900 dark:text-gray-100">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-gray-200 dark:divide-gray-700">
                  {kpis.brokerExpenseData?.map((broker: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{broker.broker}</td>
                      <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                        ${(broker.commissionFee || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                        ${(broker.brokerageFee || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-600 dark:text-gray-400">
                        ${(broker.settlementCost || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right font-semibold text-gray-900 dark:text-gray-100">
                        ${(broker.totalExpense || 0).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "kri" && (
        <div className="space-y-8">
          {/* KRI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <InfoCard
              title="Cost Overruns"
              value={`${kris.commissionCostOverruns || 0}`}
              description="Trades exceeding commission benchmark."
              isRisk={true}
              icon={<Icons.CostOverrun />}
            />
            <InfoCard
              title="Unallocated Costs"
              value={`${kris.unallocatedCosts || 0}`}
              description="Commission entries not properly allocated."
              isRisk={true}
              icon={<Icons.Unallocated />}
            />
            <InfoCard
              title="Unallocated %"
              value={`${kris.percentageUnallocatedCosts?.toFixed(1) || "0.0"}%`}
              description="Percentage of unallocated commission costs."
              isRisk={true}
              icon={<Icons.Unallocated />}
            />
            <InfoCard
              title="Incomplete Data"
              value={`${kris.missingOrIncompleteData || 0}`}
              description="Records with missing critical information."
              isRisk={true}
              icon={<Icons.IncompleteData />}
            />
          </div>

          {/* KRI Charts */}
          <div className="space-y-8">
            {/* 1. Commission Cost Overview */}
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">1. Commission Cost Overview</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Overall risk assessment across key commission risk indicators.
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={kris.kriRadarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis domain={[0, 100]} />
                    <Radar
                      name="Risk Level (%)"
                      dataKey="A"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.3}
                    />
                    <Tooltip formatter={(value) => `${value}%`} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">Higher values indicate higher risk levels across different categories</p>
            </div>

            {/* 2. High Commission Brokers */}
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">2. High Commission Brokers</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Detects brokers receiving disproportionately high commissions, indicating possible over-reliance or negotiation gaps.
              </p>
              <div className="h-72 w-full">
                <HighCommissionBrokersChart trades={trades} />
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">Cursor Hint: group by brokerName, sum commissionAmount</p>
            </div>

            {/* 3. Late Commission Approvals */}
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">3. Late Commission Approvals</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Flags operational inefficiencies or control issues in the approval process.
              </p>
              <div className="h-72 w-full">
                <LateCommissionApprovalsChart trades={trades} />
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">Cursor Hint: calculate approval delay = approvalDate - invoiceDate; classify as on-time or late</p>
            </div>

            {/* 4. Commission Volume Trends */}
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">4. Commission Volume Trends</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Monitors unusual spikes or drops in commission volumes that may indicate issues.
              </p>
              <div className="h-72 w-full">
                <CommissionVolumeTrendsChart trades={trades} />
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">Cursor Hint: group by date, count commissions; identify anomalies</p>
            </div>

            {/* 5. Unmapped / Orphaned Commission Entries */}
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">5. Unmapped / Orphaned Commission Entries</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Highlights data quality issues or risk of missed reconciliation.
              </p>
              <div className="h-72 w-full">
                <OrphanedCommissionEntriesChart trades={trades} />
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">Cursor Hint: check if tradeId is null or missing for commission records</p>
            </div>

            {/* 6. Commission Rate Outliers */}
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">6. Commission Rate Outliers</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Detects unusually high or low rates indicating manual errors or exceptions.
              </p>
              <div className="h-72 w-full">
                <CommissionRateOutliersChart trades={trades} />
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">Cursor Hint: commissionRate = commissionAmount / tradeValue; group by brokerName</p>
            </div>

            {/* 7. Failed Commission Reconciliation */}
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">7. Failed Commission Reconciliation</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Identifies commission entries that failed reconciliation processes.
              </p>
              <div className="h-72 w-full">
                <FailedReconciliationChart trades={trades} />
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">Cursor Hint: filter where reconciliationStatus = 'failed' or 'pending'</p>
            </div>

            {/* 8. Currency Mismatch in Commission Entries */}
            <div className="card-bw p-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">8. Currency Mismatch in Commission Entries</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Identifies FX risk or input errors in commission records.
              </p>
              <div className="h-72 w-full">
                <CurrencyMismatchChart trades={trades} />
              </div>
              <p className="text-xs text-gray-500 mt-4 italic">Cursor Hint: filter where commissionCurrency ≠ tradeCurrency</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------- Helper Chart Components -----------------

function HighCommissionBrokersChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const data = useMemo(() => {
    const totals: Record<string, number> = {}
    trades.forEach((trade) => {
      const broker = (trade.broker || trade.counterparty || "Unknown") as string
      const commissionRaw = trade.commissionAmount ?? trade.commission ?? trade.commissionAmt ?? 0
      const commission = typeof commissionRaw === "string" ? Number(commissionRaw.replace(/[,$]/g, "")) : Number(commissionRaw)
      if (!isNaN(commission)) {
        totals[broker] = (totals[broker] || 0) + commission
      }
    })
    return Object.entries(totals)
      .map(([broker, sum]) => ({ broker, sum }))
      .sort((a: any, b: any) => b.sum - a.sum)
      .slice(0, 10) // top 10
  }, [trades])

  const COLORS = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"]

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">High Commission Brokers - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Broker</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Total Commission</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Rank</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => (
                <tr key={item.broker} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b font-medium">{item.broker}</td>
                  <td className="px-4 py-2 border-b text-right">${item.sum.toLocaleString()}</td>
                  <td className="px-4 py-2 border-b text-right">#{index + 1}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">High Commission Brokers - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={(v) => `$${v.toLocaleString()}`}/>
          <YAxis dataKey="broker" type="category" width={120} />
          <Tooltip formatter={(v: any) => `$${v.toLocaleString()}`} />
          <Bar dataKey="sum" name="Commission ($)" fill="#3b82f6">
            {data.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function LateCommissionApprovalsChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const data = useMemo(() => {
    const map: Record<string, { onTime: number; late: number }> = {}
    trades.forEach((t) => {
      const approval = t.approvalDate || t.approvedDate || t.approval_timestamp
      const invoice = t.invoiceDate || t.invoice_date || t.tradeDate
      if (!approval || !invoice) return
      const apprDate = new Date(approval)
      const invDate = new Date(invoice)
      if (isNaN(apprDate.getTime()) || isNaN(invDate.getTime())) return
      const diff = (apprDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24)
      const status = diff > 0 ? "Approved Late" : "Approved On Time"
      const dateKey = apprDate.toISOString().split("T")[0]
      if (!map[dateKey]) map[dateKey] = { onTime: 0, late: 0 }
      if (status === "Approved Late") map[dateKey].late += 1
      else map[dateKey].onTime += 1
    })
    // convert to array sorted by date
    return Object.entries(map)
      .map(([date, counts]: [string, { onTime: number; late: number }]) => ({ date, ...counts }))
      .sort((a: any, b: any) => (a.date > b.date ? 1 : -1))
  }, [trades])

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Late Commission Approvals - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Date</th>
                <th className="px-4 py-2 border-b text-right font-semibold">On Time</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Late</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Total</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Late %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => {
                const total = item.onTime + item.late
                const latePercent = total > 0 ? ((item.late / total) * 100).toFixed(1) : '0.0'
                return (
                  <tr key={item.date} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b font-medium">{item.date}</td>
                    <td className="px-4 py-2 border-b text-right text-green-600">{item.onTime}</td>
                    <td className="px-4 py-2 border-b text-right text-red-600">{item.late}</td>
                    <td className="px-4 py-2 border-b text-right">{total}</td>
                    <td className="px-4 py-2 border-b text-right">{latePercent}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Late Commission Approvals - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} stackOffset="sign">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false}/>
          <Tooltip />
          <Legend />
          <Bar dataKey="onTime" stackId="a" name="Approved On Time" fill="#10b981" />
          <Bar dataKey="late" stackId="a" name="Approved Late" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function OrphanedCommissionEntriesChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const counts = useMemo(() => {
    let mapped = 0
    let orphan = 0
    trades.forEach((t) => {
      if (t.tradeId || t.tradeID || t.trade_id) mapped += 1
      else orphan += 1
    })
    return [
      { name: "Mapped to Trade", value: mapped },
      { name: "Not Mapped", value: orphan },
    ]
  }, [trades])

  const COLORS = ["#3b82f6", "#ef4444"]

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Orphaned Commission Entries - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Category</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Count</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((item, index) => {
                const total = counts.reduce((sum, c) => sum + c.value, 0)
                const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0'
                return (
                  <tr key={item.name} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b font-medium">{item.name}</td>
                    <td className="px-4 py-2 border-b text-right">{item.value}</td>
                    <td className="px-4 py-2 border-b text-right">{percentage}%</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Orphaned Commission Entries - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={counts} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} label>
            {counts.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

function CommissionRateOutliersChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const scatterData = useMemo(() => {
    const arr: { broker: string; rate: number }[] = []
    trades.forEach((t) => {
      const broker = (t.broker || t.counterparty || "Unknown") as string
      const commissionRaw = t.commissionAmount ?? t.commission ?? t.commissionAmt ?? 0
      const tradeValueRaw = t.tradeValue ?? t.notionalAmount ?? t.notional ?? 0
      const commission = typeof commissionRaw === "string" ? Number(commissionRaw.replace(/[,$]/g, "")) : Number(commissionRaw)
      const tradeVal = typeof tradeValueRaw === "string" ? Number(tradeValueRaw.replace(/[,$]/g, "")) : Number(tradeValueRaw)
      if (tradeVal > 0 && !isNaN(commission) && !isNaN(tradeVal)) {
        const rate = (commission / tradeVal) * 100
        arr.push({ broker, rate })
      }
    })
    return arr.sort((a, b) => b.rate - a.rate)
  }, [trades])

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Commission Rate Outliers - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Broker</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Commission Rate (%)</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {scatterData.map((item, index) => {
                const isOutlier = item.rate > 1.0 || item.rate < 0.01
                return (
                  <tr key={`${item.broker}-${index}`} className={`hover:bg-gray-50 ${isOutlier ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2 border-b font-medium">{item.broker}</td>
                    <td className="px-4 py-2 border-b text-right">{item.rate.toFixed(4)}%</td>
                    <td className="px-4 py-2 border-b text-right">
                      {isOutlier ? (
                        <span className="text-red-600 font-semibold">⚠️ Outlier</span>
                      ) : (
                        <span className="text-green-600">✅ Normal</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Commission Rate Outliers - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart>
          <CartesianGrid />
          <XAxis type="category" dataKey="broker" name="Broker" interval={0} tick={{ fontSize: 10 }} />
          <YAxis type="number" dataKey="rate" name="Commission Rate (%)" unit="%" />
          <ZAxis range={[50, 50]} />
          <Tooltip formatter={(value: number) => `${value.toFixed(2)}%`} />
          <Scatter data={scatterData} fill="#6366f1" name="Commission Rate" />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function CurrencyMismatchChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const data = useMemo(() => {
    const counts: Record<string, number> = {}
    const details: Array<{ trade: any; commissionCur: string; tradeCur: string }> = []
    
    trades.forEach((t) => {
      const commissionCur = (t.commissionCurrency || t.currency || t.dealtCurrency || t.baseCurrency) as string
      const tradeCur = (t.tradeCurrency || t.dealtCurrency || t.baseCurrency || t.currency) as string
      if (!commissionCur || !tradeCur) return
      if (commissionCur !== tradeCur) {
        counts[commissionCur] = (counts[commissionCur] || 0) + 1
        details.push({ trade: t, commissionCur, tradeCur })
      }
    })
    
    return {
      chartData: Object.entries(counts).map(([currency, count]) => ({ currency, count })),
      details
    }
  }, [trades])

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Currency Mismatch - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Trade ID</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Commission Currency</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Trade Currency</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Risk Level</th>
              </tr>
            </thead>
            <tbody>
              {data.details.slice(0, 50).map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b font-medium">
                    {item.trade.tradeId || item.trade.tradeID || item.trade.trade_id || 'N/A'}
                  </td>
                  <td className="px-4 py-2 border-b">{item.commissionCur}</td>
                  <td className="px-4 py-2 border-b">{item.tradeCur}</td>
                  <td className="px-4 py-2 border-b">
                    <span className="text-amber-600">⚠️ Mismatch</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.details.length > 50 && (
            <p className="text-sm text-gray-500 mt-2">
              Showing first 50 of {data.details.length} mismatched records
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Currency Mismatch - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.chartData}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="currency" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#facc15" name="Mismatched Records" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function CommissionVolumeTrendsChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const data = useMemo(() => {
    const dailyCounts: Record<string, number> = {}
    
    trades.forEach((t) => {
      const date = t.tradeDate || t.trade_date || t.date || t.created_at
      if (!date) return
      
      const dateObj = new Date(date)
      if (isNaN(dateObj.getTime())) return
      
      const dateKey = dateObj.toISOString().split('T')[0]
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1
    })
    
    return Object.entries(dailyCounts)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [trades])

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Commission Volume Trends - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Date</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Commission Count</th>
                <th className="px-4 py-2 border-b text-right font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item, index) => {
                const avg = data.reduce((sum, d) => sum + d.count, 0) / data.length
                const isAnomalous = item.count > avg * 2 || item.count < avg * 0.5
                return (
                  <tr key={item.date} className="hover:bg-gray-50">
                    <td className="px-4 py-2 border-b font-medium">{item.date}</td>
                    <td className="px-4 py-2 border-b text-right">{item.count}</td>
                    <td className="px-4 py-2 border-b text-right">
                      {isAnomalous ? (
                        <span className="text-red-600">⚠️ Anomaly</span>
                      ) : (
                        <span className="text-green-600">✅ Normal</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Commission Volume Trends - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" name="Commission Count" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function FailedReconciliationChart({ trades }: { trades: TradeData[] }) {
  const [viewMode, setViewMode] = useState<'table' | 'chart'>('table')
  
  const data = useMemo(() => {
    let successful = 0
    let failed = 0
    let pending = 0
    const details: Array<{ trade: any; status: string; reason: string }> = []
    
    trades.forEach((t) => {
      const reconciliationStatus = (t.reconciliationStatus || t.settlementStatus || t.status || 'unknown').toLowerCase()
      
      if (['completed', 'settled', 'reconciled', 'success'].includes(reconciliationStatus)) {
        successful++
      } else if (['failed', 'error', 'rejected'].includes(reconciliationStatus)) {
        failed++
        details.push({ trade: t, status: 'Failed', reason: reconciliationStatus })
      } else if (['pending', 'processing', 'in_progress'].includes(reconciliationStatus)) {
        pending++
        details.push({ trade: t, status: 'Pending', reason: reconciliationStatus })
      } else {
        pending++
        details.push({ trade: t, status: 'Unknown', reason: reconciliationStatus })
      }
    })
    
    return {
      chartData: [
        { status: 'Successful', count: successful },
        { status: 'Failed', count: failed },
        { status: 'Pending', count: pending }
      ],
      details
    }
  }, [trades])

  const COLORS = ['#10b981', '#ef4444', '#f59e0b']

  if (viewMode === 'table') {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold">Failed Reconciliation - Data Table</h4>
          <button 
            onClick={() => setViewMode('chart')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📊 View Chart
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 border-b text-left font-semibold">Trade ID</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Status</th>
                <th className="px-4 py-2 border-b text-left font-semibold">Reason</th>
              </tr>
            </thead>
            <tbody>
              {data.details.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border-b font-medium">
                    {item.trade.tradeId || item.trade.tradeID || item.trade.trade_id || 'N/A'}
                  </td>
                  <td className="px-4 py-2 border-b">
                    <span className={`font-medium ${
                      item.status === 'Failed' ? 'text-red-600' : 
                      item.status === 'Pending' ? 'text-yellow-600' : 'text-gray-600'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 border-b">{item.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold">Failed Reconciliation - Chart View</h4>
        <button 
          onClick={() => setViewMode('table')}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          📋 Back to Table
        </button>
      </div>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie 
            data={data.chartData} 
            dataKey="count" 
            nameKey="status" 
            innerRadius={60} 
            outerRadius={80} 
            label
          >
            {data.chartData.map((_, i) => (<Cell key={i} fill={COLORS[i % COLORS.length]} />))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
