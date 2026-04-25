import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates and downloads a professional subscription invoice PDF.
 * @param {Object} invoice - Invoice data from backend
 * @param {Object} user - Current user object
 */
export function generateInvoicePDF(invoice, user) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PRIMARY = [14, 116, 80];    // #0e7450 emerald
  const DARK    = [28, 28, 28];
  const GRAY    = [100, 100, 100];
  const LIGHT   = [245, 245, 245];
  const WHITE   = [255, 255, 255];

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, pageW, 38, 'F');

  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('GRUVORA LIVING', 14, 16);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Gujarat\'s #1 Property Platform', 14, 23);
  doc.text('support@gruvora.com  |  gruvora.com', 14, 29);

  // Invoice label (right side)
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageW - 14, 18, { align: 'right' });

  const invoiceNumber = invoice.invoice_number || invoice.id?.slice(0, 8).toUpperCase() || 'INV-000001';
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${invoiceNumber}`, pageW - 14, 25, { align: 'right' });

  // ── Meta row ─────────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.rect(0, 38, pageW, 22, 'F');

  const paidAt   = invoice.activated_at || invoice.paid_at || invoice.created_at;
  const expiresAt = invoice.expires_at;
  const fmtDate  = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

  doc.setTextColor(...DARK);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DATE', 14, 46);
  doc.text('VALID UNTIL', 70, 46);
  doc.text('PAYMENT ID', 126, 46);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(fmtDate(paidAt), 14, 52);
  doc.text(fmtDate(expiresAt), 70, 52);
  const paymentId = invoice.paytm_txn_id || invoice.razorpay_payment_id || 'N/A';
  doc.text(paymentId.length > 22 ? paymentId.slice(0, 22) + '…' : paymentId, 126, 52);

  // ── Bill To ───────────────────────────────────────────────────────────────
  let y = 72;
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', 14, y);

  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(user?.name || 'Owner', 14, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(user?.email || '', 14, y + 12);
  if (user?.phone) doc.text(user.phone, 14, y + 18);
  if (user?.city)  doc.text(`${user.city}${user.state ? ', ' + user.state : ''}`, 14, y + 24);

  // ── Plan summary (right side) ─────────────────────────────────────────────
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('SUBSCRIPTION DETAILS', pageW - 14, y, { align: 'right' });

  const planLabel = formatPlanLabel(invoice.plan);
  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(planLabel, pageW - 14, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Status: Active`, pageW - 14, y + 12, { align: 'right' });
  doc.text(`Billing: Monthly`, pageW - 14, y + 18, { align: 'right' });

  // ── Line items table ──────────────────────────────────────────────────────
  y += 36;
  const amountPaise = invoice.amount || 0;
  const amountRs    = amountPaise / 100;
  const gst         = 0; // no GST for now
  const total       = amountRs + gst;

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Period', 'Amount']],
    body: [
      [
        '1',
        `${planLabel} — Monthly Subscription`,
        `${fmtDate(paidAt)} → ${fmtDate(expiresAt)}`,
        `₹${amountRs.toLocaleString('en-IN')}`,
      ],
    ],
    foot: [
      ['', '', 'Subtotal', `₹${amountRs.toLocaleString('en-IN')}`],
      ['', '', 'GST (0%)', '₹0'],
      ['', '', 'Total Paid', `₹${total.toLocaleString('en-IN')}`],
    ],
    headStyles: {
      fillColor: PRIMARY,
      textColor: WHITE,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 9, textColor: DARK },
    footStyles: { fontSize: 9, fontStyle: 'bold', textColor: DARK, fillColor: LIGHT },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 90 },
      2: { cellWidth: 50 },
      3: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    theme: 'grid',
  });

  // ── Payment confirmation box ──────────────────────────────────────────────
  const afterTable = doc.lastAutoTable.finalY + 10;
  doc.setFillColor(236, 253, 245); // light green
  doc.setDrawColor(...PRIMARY);
  doc.roundedRect(14, afterTable, pageW - 28, 18, 3, 3, 'FD');

  doc.setTextColor(...PRIMARY);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('✓  Payment Received — Thank you!', 20, afterTable + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  const orderId = invoice.paytm_order_id || invoice.razorpay_order_id || 'N/A';
  const gateway = invoice.paytm_order_id ? 'Paytm' : 'Razorpay';
  doc.text(`${gateway} Order: ${orderId}`, 20, afterTable + 14);

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, pageH - 16, pageW, 16, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gruvora Living  |  Gujarat, India  |  support@gruvora.com  |  gruvora.com', pageW / 2, pageH - 6, { align: 'center' });

  // ── Save ──────────────────────────────────────────────────────────────────
  const fileName = `Gruvora_Invoice_${invoiceNumber}_${fmtDate(paidAt).replace(/ /g, '-')}.pdf`;
  doc.save(fileName);
}

function formatPlanLabel(plan) {
  const map = {
    unlimited:        'Professional Owner Plan',
    basic:            'Professional Partner Plan',
    pro:              'Pro Plan',
    service_basic:    'Service Basic Plan',
    service_verified: 'Service Verified Plan',
    service_top:      'Service Top Listing Plan',
  };
  return map[plan] || (plan ? plan.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'Subscription Plan');
}
