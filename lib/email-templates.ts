"use client"

import { cmtaAI } from "./ai-assistant"
import type { TradeData } from "./data-processor"

export interface EmailTemplate {
  subject: string
  body: string
  recipients: string[]
  priority: "low" | "medium" | "high" | "urgent"
  issueType: string
}

export class EmailTemplateGenerator {
  // Generate custom email based on issue type and trade data
  static async generateIssueEmail(
    issueType: string,
    trade: TradeData,
    customRecipients?: string[],
  ): Promise<EmailTemplate> {
    const context = {
      trade,
      issueType,
      tradeId: trade.tradeId,
      counterparty: trade.counterparty,
      symbol: trade.symbol || trade.currencyPair,
      tradeDate: trade.tradeDate,
      settlementDate: trade.settlementDate,
      tradeValue: trade.tradeValue || trade.notionalAmount,
    }

    // Try AI generation first, fallback to templates
    try {
      if (cmtaAI.available) {
        return await cmtaAI.generateEmail(`${issueType}_resolution`, context)
      }
    } catch (error) {
      console.warn("AI email generation failed, using template:", error)
    }

    // Fallback to predefined templates
    return this.getTemplateEmail(issueType, trade, customRecipients)
  }

  // Predefined email templates for different issue types
  private static getTemplateEmail(issueType: string, trade: TradeData, customRecipients?: string[]): EmailTemplate {
    const baseRecipients = customRecipients || this.getDefaultRecipients(issueType)
    const tradeInfo = `Trade ID: ${trade.tradeId}\nSymbol/Pair: ${trade.symbol || trade.currencyPair}\nCounterparty: ${trade.counterparty}\nTrade Date: ${trade.tradeDate}\nValue: ${this.formatCurrency(trade.tradeValue || trade.notionalAmount)}`

    switch (issueType.toLowerCase()) {
      case "settlement_failed":
        return {
          subject: `URGENT: Settlement Failure - Trade ${trade.tradeId} - Immediate Action Required`,
          body: `Dear Settlement Team,

We have identified a critical settlement failure that requires immediate attention and resolution.

TRADE DETAILS:
${tradeInfo}
Settlement Date: ${trade.settlementDate}
Settlement Status: ${trade.settlementStatus}

ISSUE DESCRIPTION:
The above trade has failed to settle as scheduled. This may impact our counterparty relationships and regulatory compliance.

REQUIRED ACTIONS:
1. Investigate the root cause of the settlement failure
2. Contact the counterparty (${trade.counterparty}) to resolve any outstanding issues
3. Coordinate with operations team to expedite settlement
4. Update trade status once resolved
5. Provide resolution timeline within 2 hours

ESCALATION:
If this issue cannot be resolved within 4 hours, please escalate to senior management immediately.

Please confirm receipt of this notification and provide an estimated resolution time.

Best regards,
CMTA Operations Team

---
This is an automated notification from the CMTA Risk Monitoring System.
Time: ${new Date().toLocaleString()}`,
          recipients: baseRecipients,
          priority: "urgent",
          issueType: "Settlement Failed",
        }

      case "kyc_failed":
        return {
          subject: `KYC Compliance Issue - Trade ${trade.tradeId} - Client ${trade.clientId}`,
          body: `Dear Compliance Team,

A KYC compliance issue has been identified that requires immediate review and resolution.

TRADE DETAILS:
${tradeInfo}
Client ID: ${trade.clientId}
KYC Status: ${trade.kycStatus}
KYC Check: ${trade.kycCheck}

COMPLIANCE ISSUE:
The client associated with this trade has failed KYC verification or has incomplete KYC documentation.

REQUIRED ACTIONS:
1. Review client KYC documentation immediately
2. Contact client to obtain missing documentation if required
3. Verify client identity and compliance status
4. Update KYC status in the system
5. Determine if trade can proceed or needs to be cancelled

REGULATORY IMPACT:
This issue may have regulatory implications. Please ensure all actions are documented and compliant with current regulations.

Please provide status update within 1 hour and resolution within 24 hours.

Best regards,
CMTA Compliance Monitoring

---
This is an automated notification from the CMTA Risk Monitoring System.
Time: ${new Date().toLocaleString()}`,
          recipients: baseRecipients,
          priority: "high",
          issueType: "KYC Failed",
        }

      case "confirmation_failed":
        return {
          subject: `Trade Confirmation Failure - Trade ${trade.tradeId} - Action Required`,
          body: `Dear Operations Team,

A trade confirmation failure has been detected that requires immediate attention.

TRADE DETAILS:
${tradeInfo}
Confirmation Status: ${trade.confirmationStatus}
Trading Venue: ${trade.tradingVenue || trade.executionVenue}

CONFIRMATION ISSUE:
The trade confirmation process has failed or is incomplete. This may impact trade settlement and counterparty relationships.

REQUIRED ACTIONS:
1. Verify trade details with counterparty (${trade.counterparty})
2. Resend trade confirmation if necessary
3. Check communication channels and systems
4. Ensure all trade terms are accurately captured
5. Update confirmation status once resolved

TIMELINE:
Please resolve this issue within 2 hours to avoid settlement delays.

Contact the counterparty directly if automated confirmation systems are not working.

Best regards,
CMTA Operations Team

---
This is an automated notification from the CMTA Risk Monitoring System.
Time: ${new Date().toLocaleString()}`,
          recipients: baseRecipients,
          priority: "high",
          issueType: "Confirmation Failed",
        }

      case "reference_data_invalid":
        return {
          subject: `Reference Data Validation Error - Trade ${trade.tradeId}`,
          body: `Dear Data Management Team,

A reference data validation error has been identified that requires correction.

TRADE DETAILS:
${tradeInfo}
ISIN: ${trade.isin}
Reference Data Status: ${trade.referenceDataValidated}

DATA VALIDATION ISSUE:
The reference data for this trade has failed validation checks. This may indicate:
- Incorrect security identifiers
- Missing or outdated reference data
- System synchronization issues

REQUIRED ACTIONS:
1. Verify security identifiers (ISIN, Symbol, etc.)
2. Check reference data sources for accuracy
3. Update master data if corrections are needed
4. Re-validate trade data
5. Ensure data feeds are synchronized

IMPACT:
Invalid reference data can affect trade processing, risk calculations, and regulatory reporting.

Please resolve within 1 hour and confirm data accuracy.

Best regards,
CMTA Data Quality Team

---
This is an automated notification from the CMTA Risk Monitoring System.
Time: ${new Date().toLocaleString()}`,
          recipients: baseRecipients,
          priority: "medium",
          issueType: "Reference Data Invalid",
        }

      default:
        return {
          subject: `Trade Issue Detected - Trade ${trade.tradeId} - Review Required`,
          body: `Dear Operations Team,

An issue has been detected with the following trade that requires review.

TRADE DETAILS:
${tradeInfo}

ISSUE TYPE: ${issueType}

Please review this trade and take appropriate action to resolve any outstanding issues.

Best regards,
CMTA Operations Team

---
This is an automated notification from the CMTA Risk Monitoring System.
Time: ${new Date().toLocaleString()}`,
          recipients: baseRecipients,
          priority: "medium",
          issueType: issueType,
        }
    }
  }

  // Get default recipients based on issue type
  private static getDefaultRecipients(issueType: string): string[] {
    const recipients = {
      settlement_failed: ["settlement.team@barclays.com", "operations@barclays.com", "risk.management@barclays.com"],
      kyc_failed: ["compliance@barclays.com", "kyc.team@barclays.com", "risk.management@barclays.com"],
      confirmation_failed: ["operations@barclays.com", "trade.support@barclays.com", "middle.office@barclays.com"],
      reference_data_invalid: [
        "data.management@barclays.com",
        "reference.data@barclays.com",
        "operations@barclays.com",
      ],
    }

    return recipients[issueType.toLowerCase()] || ["operations@barclays.com", "support@barclays.com"]
  }

  // Format currency values
  private static formatCurrency(value: number | undefined): string {
    if (!value) return "N/A"
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value)
  }

  // Generate Gmail compose URL
  static generateGmailUrl(email: EmailTemplate): string {
    const params = new URLSearchParams({
      to: email.recipients.join(","),
      subject: email.subject,
      body: email.body,
    })

    return `https://mail.google.com/mail/?view=cm&fs=1&${params.toString()}`
  }
}
