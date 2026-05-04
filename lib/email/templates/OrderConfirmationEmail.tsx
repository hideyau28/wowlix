import { Heading, Hr, Section, Text } from "@react-email/components";
import EmailShell from "./EmailShell";

const styles = {
  eyebrow: {
    fontSize: "11px",
    fontWeight: 500,
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: "#6F6A63",
    margin: "0 0 8px",
  },
  heading: {
    fontSize: "26px",
    fontWeight: 400,
    letterSpacing: "-0.02em",
    lineHeight: 1.15,
    color: "#1A1A1A",
    margin: "0 0 12px",
  },
  body: {
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#1A1A1A",
    margin: "16px 0",
  },
  fineText: {
    fontSize: "13px",
    color: "#6F6A63",
    lineHeight: 1.6,
    margin: "16px 0 0",
  },
  // Order number panel — quick scan target
  orderPanel: {
    backgroundColor: "#F8F6F2",
    border: "1px solid #E8E5DE",
    padding: "16px 20px",
    margin: "20px 0",
  },
  orderLabel: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.22em",
    textTransform: "uppercase" as const,
    color: "#6F6A63",
    margin: "0 0 4px",
  },
  orderNumber: {
    fontSize: "20px",
    fontWeight: 600,
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
    color: "#1A1A1A",
    margin: 0,
    letterSpacing: "0.05em",
  },
  // Item rows
  itemRow: {
    fontSize: "14px",
    color: "#1A1A1A",
    padding: "10px 0",
    borderBottom: "1px solid #E8E5DE",
    margin: 0,
  },
  itemQty: {
    color: "#6F6A63",
    fontVariantNumeric: "tabular-nums" as const,
  },
  itemPrice: {
    fontVariantNumeric: "tabular-nums" as const,
    fontWeight: 500,
  },
  totalsRow: {
    fontSize: "13px",
    color: "#6F6A63",
    padding: "6px 0",
    margin: 0,
    fontVariantNumeric: "tabular-nums" as const,
  },
  totalsGrandRow: {
    fontSize: "15px",
    color: "#1A1A1A",
    fontWeight: 600,
    padding: "10px 0 0",
    margin: 0,
    fontVariantNumeric: "tabular-nums" as const,
    borderTop: "1px solid #1A1A1A",
  },
};

type Item = {
  name?: string;
  title?: string;
  unitPrice?: number;
  price?: number;
  quantity?: number;
  qty?: number;
  size?: string;
};

type Amounts = {
  subtotal?: number;
  discount?: number;
  deliveryFee?: number;
  total?: number;
  currency?: string;
};

type Props = {
  customerName: string;
  orderNumber: string;
  items: Item[];
  amounts: Amounts;
  /** When true, payment proof was uploaded — copy reflects "we'll confirm". */
  awaitingConfirmation?: boolean;
  /** Tenant branding override; falls back to WoWlix default in EmailShell. */
  brand?: { name?: string; tagline?: string };
};

const fmtMoney = (v: number | undefined, currency = "HKD"): string => {
  if (v == null || Number.isNaN(v)) return "—";
  return `${currency} ${v.toLocaleString("en-HK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
};

export default function OrderConfirmationEmail({
  customerName,
  orderNumber,
  items,
  amounts,
  awaitingConfirmation = false,
  brand,
}: Props) {
  const currency = amounts.currency || "HKD";
  const storeName = brand?.name || "WoWlix";

  return (
    <EmailShell
      preview={`${storeName} order ${orderNumber} confirmed`}
      brand={brand}
    >
      <Text style={styles.eyebrow}>
        {awaitingConfirmation ? "Order received" : "Order confirmed"}
      </Text>
      <Heading style={styles.heading}>
        Thanks for your order, {customerName}.
      </Heading>
      <Text style={styles.body}>
        {awaitingConfirmation
          ? "We've received your order and payment proof. We'll confirm it shortly and update you when it ships."
          : "We've received your order. We'll let you know as soon as it ships."}
      </Text>

      <Section style={styles.orderPanel}>
        <Text style={styles.orderLabel}>Order number</Text>
        <Text style={styles.orderNumber}>{orderNumber}</Text>
      </Section>

      {items.length > 0 && (
        <Section>
          {items.map((item, i) => {
            const name = item.name || item.title || "Item";
            const qty = item.quantity ?? item.qty ?? 1;
            const unit = item.unitPrice ?? item.price ?? 0;
            const lineTotal = unit * qty;
            return (
              <Text key={i} style={styles.itemRow}>
                <span>{name}</span>
                {item.size ? (
                  <span style={styles.itemQty}> · {item.size}</span>
                ) : null}
                <span style={styles.itemQty}> × {qty}</span>
                <span style={{ float: "right", ...styles.itemPrice }}>
                  {fmtMoney(lineTotal, currency)}
                </span>
              </Text>
            );
          })}
        </Section>
      )}

      <Section style={{ marginTop: "16px" }}>
        {amounts.subtotal != null && (
          <Text style={styles.totalsRow}>
            Subtotal
            <span style={{ float: "right" }}>
              {fmtMoney(amounts.subtotal, currency)}
            </span>
          </Text>
        )}
        {amounts.discount != null && amounts.discount > 0 && (
          <Text style={styles.totalsRow}>
            Discount
            <span style={{ float: "right" }}>
              −{fmtMoney(amounts.discount, currency)}
            </span>
          </Text>
        )}
        {amounts.deliveryFee != null && amounts.deliveryFee > 0 && (
          <Text style={styles.totalsRow}>
            Delivery
            <span style={{ float: "right" }}>
              {fmtMoney(amounts.deliveryFee, currency)}
            </span>
          </Text>
        )}
        <Text style={styles.totalsGrandRow}>
          Total
          <span style={{ float: "right" }}>
            {fmtMoney(amounts.total, currency)}
          </span>
        </Text>
      </Section>

      <Hr
        style={{
          borderTop: "1px solid #E8E5DE",
          borderBottom: 0,
          borderLeft: 0,
          borderRight: 0,
          margin: "32px 0 0",
        }}
      />

      <Text style={styles.fineText}>
        Questions about this order? Reply to this email and {storeName} will
        get back to you.
      </Text>
    </EmailShell>
  );
}
