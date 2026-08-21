import { promises as fs } from "node:fs";
import path from "node:path";
import { escapeHtml } from "./escape";

type ReceiptItem = {
  name?: string;
  title?: string;
  unitPrice?: number;
  price?: number;
  quantity?: number;
  qty?: number;
  size?: string;
  sizeSystem?: string;
};

type ReceiptOrder = {
  id: string;
  customerName: string;
  phone: string;
  email?: string | null;
  items: ReceiptItem[];
  amounts: {
    subtotal?: number;
    discount?: number;
    deliveryFee?: number;
    total?: number;
    currency?: string;
  };
  createdAt: Date | string;
};

function formatMoney(amount: number | undefined, currency: string) {
  if (typeof amount !== "number" || Number.isNaN(amount)) return `${currency} 0.00`;
  return `${currency} ${amount.toFixed(2)}`;
}

export function renderReceiptHtml(order: ReceiptOrder) {
  // currency 都可能係租戶/請求嚟嘅動態值 → escape 一次；formatMoney 只再拼數字，安全。
  const currency = escapeHtml(order.amounts?.currency || "HKD");
  const createdAt = escapeHtml(new Date(order.createdAt).toLocaleString());

  const rows = order.items
    .map((item) => {
      const name = escapeHtml(item.name || item.title || "Item");
      const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : Number(item.price || 0);
      const quantity = typeof item.quantity === "number" ? item.quantity : Number(item.qty || 0);
      const lineTotal = unitPrice * quantity;
      const sizeLabel = item.size
        ? `${item.sizeSystem ? `${escapeHtml(item.sizeSystem)} ` : ""}${escapeHtml(item.size)}`
        : "—";
      return `
        <tr>
          <td>${name}</td>
          <td>${sizeLabel}</td>
          <td style="text-align:right;">${formatMoney(unitPrice, currency)}</td>
          <td style="text-align:right;">${quantity}</td>
          <td style="text-align:right;">${formatMoney(lineTotal, currency)}</td>
        </tr>
      `;
    })
    .join("");

  return `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Order Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 24px; color: #111; }
        .container { max-width: 760px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #e5e7eb; }
        .header { background: #4b5e3c; color: #fff; padding: 24px; }
        .header h1 { margin: 0; font-size: 24px; }
        .section { padding: 24px; border-bottom: 1px solid #e5e7eb; }
        .section:last-child { border-bottom: 0; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; font-size: 14px; }
        th { text-align: left; background: #f3f4f6; }
        .totals td { border: 0; }
        .totals .label { text-align: right; color: #6b7280; }
        .totals .value { text-align: right; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>HK•Market Receipt</h1>
          <div>Order ID: ${escapeHtml(order.id)}</div>
          <div>Date: ${createdAt}</div>
        </div>

        <div class="section">
          <h3>Customer Details</h3>
          <div>Name: ${escapeHtml(order.customerName)}</div>
          <div>Phone: ${escapeHtml(order.phone)}</div>
          ${order.email ? `<div>Email: ${escapeHtml(order.email)}</div>` : ""}
        </div>

        <div class="section">
          <h3>Items</h3>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Size</th>
                <th style="text-align:right;">Price</th>
                <th style="text-align:right;">Qty</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>

        <div class="section">
          <table>
            <tbody class="totals">
              <tr>
                <td class="label">Subtotal</td>
                <td class="value">${formatMoney(order.amounts.subtotal || 0, currency)}</td>
              </tr>
              ${order.amounts.discount
                ? `<tr><td class="label">Discount</td><td class="value">-${formatMoney(order.amounts.discount || 0, currency)}</td></tr>`
                : ""}
              ${order.amounts.deliveryFee
                ? `<tr><td class="label">Delivery</td><td class="value">${formatMoney(order.amounts.deliveryFee || 0, currency)}</td></tr>`
                : ""}
              <tr>
                <td class="label">Total</td>
                <td class="value">${formatMoney(order.amounts.total || 0, currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </body>
  </html>
  `;
}

export async function saveReceiptHtml(order: ReceiptOrder) {
  const html = renderReceiptHtml(order);
  const dir = "/tmp/receipts";
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${order.id}.html`);
  await fs.writeFile(filePath, html, "utf8");
  return filePath;
}
