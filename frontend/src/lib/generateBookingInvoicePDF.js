import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Generates and downloads a professional booking invoice PDF.
 * @param {Object} booking - Booking data
 * @param {Object} user - Current user (customer) object
 */
export function generateBookingInvoicePDF(booking, user) {
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
  doc.text('BOOKING INVOICE', pageW - 14, 18, { align: 'right' });

  const invoiceNumber = booking.invoice_number || `INV-B-${booking.id?.slice(0, 8).toUpperCase()}`;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`#${invoiceNumber}`, pageW - 14, 25, { align: 'right' });

  // ── Meta row ─────────────────────────────────────────────────────────────
  doc.setFillColor(...LIGHT);
  doc.rect(0, 38, pageW, 22, 'F');

  const createdAt = booking.created_at;
  const fmtDate  = (iso) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';

  doc.setTextColor(...DARK);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BOOKING DATE', 14, 46);
  doc.text('CATEGORY', 70, 46);
  doc.text('PAYMENT ID', 126, 46);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...GRAY);
  doc.text(fmtDate(createdAt), 14, 52);
  doc.text(String(booking.listing_category || 'Stay').toUpperCase(), 70, 52);
  const paymentId = booking.razorpay_payment_id || 'N/A';
  doc.text(paymentId.length > 22 ? paymentId.slice(0, 22) + '…' : paymentId, 126, 52);

  // ── Bill To ───────────────────────────────────────────────────────────────
  let y = 72;
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('CUSTOMER DETAILS', 14, y);

  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(user?.name || booking.user_name || 'Guest', 14, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(user?.email || '', 14, y + 12);
  if (user?.phone || booking.user_phone) doc.text(user?.phone || booking.user_phone, 14, y + 18);

  // ── Booking summary (right side) ─────────────────────────────────────────────
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('PROPERTY DETAILS', pageW - 14, y, { align: 'right' });

  doc.setTextColor(...DARK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(booking.listing_title || 'Property', pageW - 14, y + 6, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.text(`Booking ID: ${booking.id?.slice(0, 8)}`, pageW - 14, y + 12, { align: 'right' });
  doc.text(`Status: Confirmed`, pageW - 14, y + 18, { align: 'right' });

  // ── Line items table ──────────────────────────────────────────────────────
  y += 36;
  
  // Normalize price: prefer total_price (INR), fallback to amount_paid (paise for legacy)
  let totalAmount = booking.total_price || booking.amount_paid || 0;
  // Legacy check: if amount_paid is suspiciously large and total_price is missing, it's likely paise
  if (!booking.total_price && booking.amount_paid > 50000) {
      totalAmount = booking.amount_paid / 100;
  }

  autoTable(doc, {
    startY: y,
    head: [['#', 'Description', 'Quantity', 'Amount']],
    body: [
      [
        '1',
        `${booking.listing_title} - ${booking.listing_category || 'Stay'} Booking\nDate: ${booking.booking_date}${booking.end_date ? ' to ' + booking.end_date : ''}`,
        `${booking.guests || 1} Guests`,
        `₹${totalAmount.toLocaleString('en-IN')}`,
      ],
    ],
    foot: [
      ['', '', 'Subtotal', `₹${totalAmount.toLocaleString('en-IN')}`],
      ['', '', 'GST (0%)', '₹0'],
      ['', '', 'Total Paid', `₹${totalAmount.toLocaleString('en-IN')}`],
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
  doc.text('✓  Booking Confirmed & Paid — Thank you!', 20, afterTable + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...GRAY);
  doc.text(`Razorpay Order: ${booking.razorpay_order_id || 'N/A'}`, 20, afterTable + 14);

  // ── Footer ────────────────────────────────────────────────────────────────
  doc.setFillColor(...PRIMARY);
  doc.rect(0, pageH - 16, pageW, 16, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Gruvora Living  |  Gujarat, India  |  support@gruvora.com  |  gruvora.com', pageW / 2, pageH - 6, { align: 'center' });

  // ── Save ──────────────────────────────────────────────────────────────────
  const fileName = `Gruvora_Booking_Invoice_${invoiceNumber}_${fmtDate(createdAt).replace(/ /g, '-')}.pdf`;
  doc.save(fileName);
}
