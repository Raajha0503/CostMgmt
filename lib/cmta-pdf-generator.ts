// lib/cmta-pdf-generator.ts – pixel-perfect CMTA PDF template

import jsPDF from 'jspdf'

// ---------- Types ---------- //
export interface CMTAAgreementData {
  id: string
  Broker: string
  client: string
  BrokerageCurrency?: string
  BrokerageFee?: string | number
  EffectiveDate_Equity?: string
  EffectiveDate_Forex?: string
  LEI?: string
  clientId?: string
  version: string
  generatedOn: string
  lastModified: string
}

// ---------- Constants (pt) ---------- //
const PAGE_W = 595.28 // A4 width in points
const PAGE_H = 841.89 // A4 height in points
const MARGIN = 54       // ≈ 19 mm
const BODY_FONT = 'times'
const BLUE = { r: 0, g: 132, b: 180 }
const DARK = { r: 51, g: 51, b: 51 }
const GRAY = { r: 102, g: 102, b: 102 }

function drawLogo(doc: jsPDF) {
  doc.setFillColor(BLUE.r, BLUE.g, BLUE.b);
  doc.circle(MARGIN + 10, 40, 10, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(18).setTextColor(BLUE.r, BLUE.g, BLUE.b);
  doc.text('BARCLAYS', MARGIN + 28, 46);
}

export class CMTAPDFGenerator {
  // -------- Public helpers -------- //
  static async generatePreview(data: CMTAAgreementData) {
    const doc = this.buildDoc(data, false)
    const blobUrl = doc.output('bloburl')
    window.open(blobUrl, '_blank')
  }

  static async downloadSignedAgreement(data: CMTAAgreementData) {
    const doc = this.buildDoc(data, true)
    const safeClient = data.client.replace(/[^a-z0-9]/gi, '_')
    doc.save(`CMTA_Agreement_${safeClient}_${data.version}.pdf`)
  }

  // -------- Private core -------- //
  private static buildDoc(d: CMTAAgreementData, signed: boolean): jsPDF {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' })

         // HEADER ---------------------------------------------------------- //
     drawLogo(doc)

    doc.setFont(BODY_FONT, 'normal').setFontSize(12).setTextColor(0, 0, 0)
    doc.text(new Date().toLocaleDateString('en-GB'), PAGE_W - MARGIN, 40, { align: 'right' })

    doc.setFont(BODY_FONT, 'bold').setFontSize(20)
    doc.text('Clearing Member Trade Agreement (CMTA)', PAGE_W / 2, 100, { align: 'center' })

         // BODY ------------------------------------------------------------ //
     let y = 128
     const leading = 14 // line spacing

    doc.setFont(BODY_FONT, 'normal').setFontSize(12)
    doc.text(`This agreement is made on ${new Date().toLocaleDateString('en-GB')} between:`, MARGIN, y)
    y += leading * 2

    doc.setFontSize(11)
    const parties = [
      `1. ${d.Broker || 'ICAP'}, ('Execution Broker'),`,
      `2. ${d.client || 'Goldman Sachs'}, LEI: ${d.LEI || 'E57ODZWZ7FF3'}, ('Client'), and`,
      '3. Barclays Investment Bank Ltd, (\'Clearing Member\')',
    ]
    parties.forEach((txt) => {
      doc.text(txt, MARGIN, y)
      y += leading
    })
    y += 10

    // Scope section
    doc.setFont(BODY_FONT, 'bold').setFontSize(14).text('Scope & Effective Dates', MARGIN, y)
    y += leading + 4

    doc.setFont(BODY_FONT, 'normal').setFontSize(11)
    doc.text(
      'The Client authorize the Clearing Member to clear trades executed by the Execution Broker under the following asset classes and effective dates:',
      MARGIN,
      y,
      { maxWidth: PAGE_W - MARGIN * 2 }
    )
    y += leading * 3

    doc.setFont(BODY_FONT, 'bold')
    doc.text('Equity', MARGIN, y)
    doc.setFont(BODY_FONT, 'normal')
    doc.text(`Effective from: ${d.EffectiveDate_Equity || '20/07/25'}`, MARGIN + 100, y)
    y += leading
    doc.setFont(BODY_FONT, 'bold')
    doc.text('Forex', MARGIN, y)
    doc.setFont(BODY_FONT, 'normal')
    doc.text(`Effective from: ${d.EffectiveDate_Forex || '19/07/25'}`, MARGIN + 100, y)
    y += leading * 2

    // Fee Schedule table (manual) ------------------------------------ //
    this.drawFeeTable(doc, d, y)
    y += 72 // table height (3 rows * 24)

    // Client Reference
    doc.setFont(BODY_FONT, 'bold').setFontSize(14).text('Client Reference', MARGIN, y)
    y += leading + 4
    doc.setFont(BODY_FONT, 'normal').setFontSize(11)
    doc.text(`Client ID: ${d.clientId || 'CID5000'}`, MARGIN, y)
    doc.text('LEI:', PAGE_W / 2, y)
    doc.text(d.LEI || 'E57ODZW27FF3', PAGE_W / 2 + 30, y)
    y += leading * 2

    // General Terms
    doc.setFont(BODY_FONT, 'bold').setFontSize(14).text('General Terms & Governing Law', MARGIN, y)
    y += leading + 4
    doc.setFont(BODY_FONT, 'normal').setFontSize(11)
    const terms =
      'This agreement shall remain in effect until terminated by either party with 30 days\' written notice. ' +
      'This agreement shall be governed by and construed in accordance with is law of [Jurisdiction].'
    doc.text(terms, MARGIN, y, { maxWidth: PAGE_W - MARGIN * 2 })

    // SIGNATURES ------------------------------------------------------ //
    this.drawSignatureLines(doc, signed)

    return doc
  }

  // -------- drawing helpers ---------- //
  private static drawFeeTable(doc: jsPDF, d: CMTAAgreementData, startY: number) {
    const fee = parseFloat(String(d.BrokerageFee || '488.63').replace(/[^0-9.]/g, '')) || 488.63
    const curr = d.BrokerageCurrency || 'USD'

    const rowH = 24
    const x = MARGIN
    const w1 = 220
    const w2 = 100
    const w3 = 80
    const tableW = w1 + w2 + w3

    // outer border
    doc.setLineWidth(0.5).rect(x, startY, tableW, rowH * 3)
    // horizontal lines
    doc.line(x, startY + rowH, x + tableW, startY + rowH)
    doc.line(x, startY + rowH * 2, x + tableW, startY + rowH * 2)
    // vertical lines
    doc.line(x + w1, startY, x + w1, startY + rowH * 3)
    doc.line(x + w1 + w2, startY, x + w1 + w2, startY + rowH * 3)

    // header background
    doc.setFillColor(244, 245, 247)
    doc.rect(x, startY, tableW, rowH, 'F')

    // header text
    doc.setFont(BODY_FONT, 'bold').setFontSize(11).setTextColor(0)
    doc.text('Fee Schedule', x + 6, startY + 16)
    doc.text('Amount', x + w1 + 12, startY + 16)
    doc.text('Currency', x + w1 + w2 + 12, startY + 16)

         // data rows
     doc.setFont(BODY_FONT, 'normal').setFontSize(10)
     // row 1 – Brokerage Fee
     doc.text('Brokerage Fee', x + 6, startY + rowH + 16)
     const amountX = x + w1 + w2 - 8  // right-align within amount column
     doc.text(fee.toFixed(2), amountX, startY + rowH + 16, { align: 'right' })
     doc.text(curr, x + w1 + w2 + 25, startY + rowH + 16)
     // row 2 – subtotal
     doc.text('Subtotal', x + w1 + 12, startY + rowH * 2 + 16)
     doc.text(`${fee.toFixed(2)} ${curr}`, x + w1 + w2 + 25, startY + rowH * 2 + 16)
  }

  private static drawSignatureLines(doc: jsPDF, signed: boolean) {
    const baseY = PAGE_H - 100
    const lineW = 65

    // Execution Broker
    doc.line(MARGIN, baseY, MARGIN + lineW, baseY)
    doc.text('Execution Broker', MARGIN, baseY + 14)

    // Client
    const clientX = PAGE_W / 2 - lineW / 2
    doc.line(clientX, baseY, clientX + lineW, baseY)
    doc.text('Client', clientX, baseY + 14)

    // Barclays
    const barX = PAGE_W - MARGIN - lineW
    doc.line(barX, baseY, barX + lineW, baseY)
    doc.text('Barclays Investment Bank Ltd', barX, baseY + 14)

    if (signed) {
      doc.setFont(BODY_FONT, 'italic').setFontSize(12)
      doc.text('John Smith', MARGIN + 2, baseY - 4)
      doc.text('Maria Rodriguez', clientX + 2, baseY - 4)
      doc.text('David Johnson', barX + 2, baseY - 4)

      doc.setFont(BODY_FONT, 'normal').setFontSize(8)
      doc.setTextColor(GRAY.r, GRAY.g, GRAY.b)
      doc.text(
        'This document contains mock signatures for demonstration purposes only. Not legally binding.',
        MARGIN,
        PAGE_H - 40
      )
      doc.setTextColor(0)
    }
  }

  // -------- utility -------- //
  static generateEditableTemplate(a: CMTAAgreementData): CMTAAgreementData {
    return {
      ...a,
      generatedOn: new Date().toLocaleDateString(),
      lastModified: new Date().toLocaleDateString(),
      version: `v${parseInt(a.version.replace('v', '')) + 1}`,
    }
  }
} 