#!/usr/bin/env bash
set -euo pipefail

# BASE can be origin OR full endpoint.
BASE="${BASE:-http://localhost:3012}"
ADMIN_SECRET="${ADMIN_SECRET:-}"

# normalize BASE to full endpoint exactly once
if [[ "$BASE" != *"/api/orders" ]]; then
  BASE="${BASE%/}/api/orders"
fi

die() { echo "FAIL: $*" >&2; exit 1; }

seed_products() {
  if command -v tsx >/dev/null 2>&1; then
    tsx scripts/seed-products.ts
    return
  fi
  if npx --yes --quiet tsx --version >/dev/null 2>&1; then
    npx --yes tsx scripts/seed-products.ts
    return
  fi
  if node -e "require.resolve('ts-node/register')" >/dev/null 2>&1; then
    node -r ts-node/register scripts/seed-products.ts
    return
  fi
  if command -v ts-node >/dev/null 2>&1; then
    ts-node scripts/seed-products.ts
    return
  fi
  die "seed runner missing: install tsx or ts-node to run scripts/seed-products.ts"
}

curl_head() {
  # prints first status line only
  curl -sS -i "$@" | sed -n "1p"
}

curl_resp() {
  curl -sS -i "$@" || true
}

resp_body() {
  echo "$1" | awk 'BEGIN{body=0} /^[[:space:]]*$/{body=1; next} {if(body) print}'
}

must_have_request_id() {
  # body contains requestId
  echo "$1" | grep -q '"requestId"' || die "expected body.requestId"
}

must_have_error_code() {
  local resp="$1"; local code="$2"
  echo "$resp" | grep -q "\"code\":\"$code\"" || die "expected error.code=$code"
}

must_have_header() {
  local resp="$1"; local header="$2"
  echo "$resp" | grep -iq "^${header}:" || die "expected header ${header}"
}

ensure_jq() {
  command -v jq >/dev/null 2>&1 || die "jq is required for smoke-orders.sh"
}

if [ -z "${ADMIN_SECRET}" ]; then
  die "ADMIN_SECRET is not set"
fi

ensure_jq

ROOT_BASE="${BASE%/api/orders}"
PRODUCTS_BASE="${ROOT_BASE%/}/api/products"

resp="$(curl_resp "$PRODUCTS_BASE?limit=1")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 200 " ]] || die "expected GET products -> 200 but got: $h (URL=$PRODUCTS_BASE)"
body="$(resp_body "$resp")"
PRODUCT_ID="$(echo "$body" | jq -r '.data.products[0].id')"
PRODUCT_NAME="$(echo "$body" | jq -r '.data.products[0].title')"
PRODUCT_PRICE="$(echo "$body" | jq -r '.data.products[0].price')"

if [ -z "$PRODUCT_ID" ] || [ "$PRODUCT_ID" = "null" ]; then
  echo "No product found; seeding demo products..."
  seed_products
  resp="$(curl_resp "$PRODUCTS_BASE?limit=1")"
  h="$(echo "$resp" | sed -n "1p")"
  [[ "$h" =~ " 200 " ]] || die "expected GET products -> 200 but got: $h (URL=$PRODUCTS_BASE)"
  body="$(resp_body "$resp")"
  PRODUCT_ID="$(echo "$body" | jq -r '.data.products[0].id')"
  PRODUCT_NAME="$(echo "$body" | jq -r '.data.products[0].title')"
  PRODUCT_PRICE="$(echo "$body" | jq -r '.data.products[0].price')"
fi

[ -n "$PRODUCT_ID" ] && [ "$PRODUCT_ID" != "null" ] || die "expected product id"
[ -n "$PRODUCT_NAME" ] && [ "$PRODUCT_NAME" != "null" ] || die "expected product name"
[ -n "$PRODUCT_PRICE" ] && [ "$PRODUCT_PRICE" != "null" ] || die "expected product price"

# Pickup 單 + 冇 coupon 嘅正路 payload：唔帶 discount / deliveryFee。
# 原因：parseCreatePayload 對 amounts.discount / deliveryFee 係「存在就必須 > 0」
# （assertPositiveNumber，<= 0 直接 400）；但 server reprice 一張 pickup + 冇 coupon
# 嘅單一定係 deliveryFee=0 / discount=0（resolveDeliveryFee 只計 delivery 單；冇
# couponCode client 傳嘅 discount 會被無視）。兩個約束對「有帶呢兩個 field」嘅情況
# 不可調和，所以正路做法係索性 omit（下面 jq amounts 唔會 include 佢哋）。
# DISCOUNT / DELIVERY_FEE 保留為 0 淨係畀 TOTAL / ALT_TOTAL 嘅 awk 用，令 total=subtotal。
QTY=2
DISCOUNT=0
DELIVERY_FEE=0
SUBTOTAL="$(awk -v p="$PRODUCT_PRICE" -v q="$QTY" 'BEGIN{print p*q}')"
TOTAL="$(awk -v s="$SUBTOTAL" -v d="$DISCOUNT" -v f="$DELIVERY_FEE" 'BEGIN{print s+f-d}')"

PAYLOAD="$(jq -n \
  --arg customerName "Ada Lovelace" \
  --arg phone "+852-5555-0000" \
  --arg email "ada@example.com" \
  --arg productId "$PRODUCT_ID" \
  --arg productName "$PRODUCT_NAME" \
  --arg currency "HKD" \
  --arg note "Leave at counter" \
  --argjson unitPrice "$PRODUCT_PRICE" \
  --argjson quantity "$QTY" \
  --argjson subtotal "$SUBTOTAL" \
  --argjson total "$TOTAL" \
  '{
    customerName: $customerName,
    phone: $phone,
    email: $email,
    items: [{productId: $productId, name: $productName, unitPrice: $unitPrice, quantity: $quantity}],
    amounts: {subtotal: $subtotal, total: $total, currency: $currency},
    fulfillment: {type: "pickup"},
    note: $note
  }')"

echo "== Orders 1) Admin auth checks (GET list) =="

resp="$(curl_resp "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 401 " ]] || die "expected HTTP 401 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_error_code "$resp" "ADMIN_AUTH_MISSING"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

resp="$(curl_resp -H "x-admin-secret: WRONG" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 403 " ]] || die "expected HTTP 403 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_error_code "$resp" "ADMIN_AUTH_INVALID"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

echo "OK: GET list no secret -> 401 (+requestId + ADMIN_AUTH_MISSING)"
echo "OK: GET list wrong secret -> 403 (+requestId + ADMIN_AUTH_INVALID)"
echo

echo "== Orders 2) Create validations =="

resp="$(curl_resp -X POST -H "content-type: application/json" --data "${PAYLOAD}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 400 " ]] || die "expected POST missing idempotency -> 400 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_error_code "$resp" "BAD_REQUEST"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

echo "OK: POST missing idempotency -> 400 + BAD_REQUEST"
echo

echo "== Orders 2.1) Payload validation (negative cases) =="

PAYLOAD_BAD_CURRENCY="$(jq -n \
  --arg customerName "Ada Lovelace" \
  --arg phone "+852-5555-0000" \
  --arg email "ada@example.com" \
  --arg productId "$PRODUCT_ID" \
  --arg productName "$PRODUCT_NAME" \
  --arg currency "HKDD" \
  --arg note "Leave at counter" \
  --argjson unitPrice "$PRODUCT_PRICE" \
  --argjson quantity "$QTY" \
  --argjson subtotal "$SUBTOTAL" \
  --argjson total "$TOTAL" \
  '{
    customerName: $customerName,
    phone: $phone,
    email: $email,
    items: [{productId: $productId, name: $productName, unitPrice: $unitPrice, quantity: $quantity}],
    amounts: {subtotal: $subtotal, total: $total, currency: $currency},
    fulfillment: {type: "pickup"},
    note: $note
  }')"
resp="$(curl_resp -X POST -H "content-type: application/json" -H "x-idempotency-key: bad-currency-$(date +%s)" --data "${PAYLOAD_BAD_CURRENCY}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 400 " ]] || die "expected POST bad currency -> 400 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_error_code "$resp" "BAD_REQUEST"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

PAYLOAD_BAD_QTY="$(jq -n \
  --arg customerName "Ada Lovelace" \
  --arg phone "+852-5555-0000" \
  --arg email "ada@example.com" \
  --arg productId "$PRODUCT_ID" \
  --arg productName "$PRODUCT_NAME" \
  --arg currency "HKD" \
  --arg note "Leave at counter" \
  --argjson unitPrice "$PRODUCT_PRICE" \
  --argjson quantity 0 \
  --argjson subtotal "$SUBTOTAL" \
  --argjson total "$TOTAL" \
  '{
    customerName: $customerName,
    phone: $phone,
    email: $email,
    items: [{productId: $productId, name: $productName, unitPrice: $unitPrice, quantity: $quantity}],
    amounts: {subtotal: $subtotal, total: $total, currency: $currency},
    fulfillment: {type: "pickup"},
    note: $note
  }')"
resp="$(curl_resp -X POST -H "content-type: application/json" -H "x-idempotency-key: bad-qty-$(date +%s)" --data "${PAYLOAD_BAD_QTY}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 400 " ]] || die "expected POST bad quantity -> 400 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_error_code "$resp" "BAD_REQUEST"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

PAYLOAD_BAD_AMOUNTS="$(jq -n \
  --arg customerName "Ada Lovelace" \
  --arg phone "+852-5555-0000" \
  --arg email "ada@example.com" \
  --arg productId "$PRODUCT_ID" \
  --arg productName "$PRODUCT_NAME" \
  --arg currency "HKD" \
  --arg note "Leave at counter" \
  --argjson unitPrice "$PRODUCT_PRICE" \
  --argjson quantity "$QTY" \
  --argjson subtotal "$SUBTOTAL" \
  --argjson total 0 \
  '{
    customerName: $customerName,
    phone: $phone,
    email: $email,
    items: [{productId: $productId, name: $productName, unitPrice: $unitPrice, quantity: $quantity}],
    amounts: {subtotal: $subtotal, total: $total, currency: $currency},
    fulfillment: {type: "pickup"},
    note: $note
  }')"
resp="$(curl_resp -X POST -H "content-type: application/json" -H "x-idempotency-key: bad-amounts-$(date +%s)" --data "${PAYLOAD_BAD_AMOUNTS}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 400 " ]] || die "expected POST bad amounts -> 400 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_error_code "$resp" "BAD_REQUEST"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

echo "OK: POST invalid currency -> 400 + BAD_REQUEST"
echo "OK: POST invalid quantity -> 400 + BAD_REQUEST"
echo "OK: POST invalid amounts -> 400 + BAD_REQUEST"
echo

echo "== Orders 2.2) Repricing checks (negative cases) =="

PAYLOAD_MISMATCH="$(jq -n \
  --arg customerName "Ada Lovelace" \
  --arg phone "+852-5555-0000" \
  --arg email "ada@example.com" \
  --arg productId "$PRODUCT_ID" \
  --arg productName "$PRODUCT_NAME" \
  --arg currency "HKD" \
  --arg note "Leave at counter" \
  --argjson unitPrice "$PRODUCT_PRICE" \
  --argjson quantity "$QTY" \
  --argjson subtotal "$SUBTOTAL" \
  --argjson total 1 \
  '{
    customerName: $customerName,
    phone: $phone,
    email: $email,
    items: [{productId: $productId, name: $productName, unitPrice: $unitPrice, quantity: $quantity}],
    amounts: {subtotal: $subtotal, total: $total, currency: $currency},
    fulfillment: {type: "pickup"},
    note: $note
  }')"
resp="$(curl_resp -X POST -H "content-type: application/json" -H "x-idempotency-key: mismatch-$(date +%s)" --data "${PAYLOAD_MISMATCH}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 400 " ]] || die "expected POST repricing mismatch -> 400 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_error_code "$resp" "BAD_REQUEST"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

PAYLOAD_BAD_PRODUCT="$(jq -n \
  --arg customerName "Ada Lovelace" \
  --arg phone "+852-5555-0000" \
  --arg email "ada@example.com" \
  --arg productId "missing-product" \
  --arg productName "$PRODUCT_NAME" \
  --arg currency "HKD" \
  --arg note "Leave at counter" \
  --argjson unitPrice "$PRODUCT_PRICE" \
  --argjson quantity "$QTY" \
  --argjson subtotal "$SUBTOTAL" \
  --argjson total "$TOTAL" \
  '{
    customerName: $customerName,
    phone: $phone,
    email: $email,
    items: [{productId: $productId, name: $productName, unitPrice: $unitPrice, quantity: $quantity}],
    amounts: {subtotal: $subtotal, total: $total, currency: $currency},
    fulfillment: {type: "pickup"},
    note: $note
  }')"
resp="$(curl_resp -X POST -H "content-type: application/json" -H "x-idempotency-key: bad-product-$(date +%s)" --data "${PAYLOAD_BAD_PRODUCT}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 400 " ]] || die "expected POST missing product -> 400 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_error_code "$resp" "BAD_REQUEST"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

echo "OK: POST repricing mismatch -> 400 + BAD_REQUEST"
echo "OK: POST missing product -> 400 + BAD_REQUEST"
echo

echo "== Orders 3) Create with idempotency =="

IDEM="smoke-order-$(date +%s)"
resp="$(curl_resp -X POST -H "content-type: application/json" -H "x-idempotency-key: ${IDEM}" --data "${PAYLOAD}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 200 " ]] || die "expected POST create -> 200 but got: $h (URL=$BASE)"
must_have_request_id "$resp"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

body="$(resp_body "$resp")"
ORDER_ID="$(echo "$body" | jq -r '.data.id')"
[ -n "$ORDER_ID" ] && [ "$ORDER_ID" != "null" ] || die "expected order id"

resp="$(curl_resp -X POST -H "content-type: application/json" -H "x-idempotency-key: ${IDEM}" --data "${PAYLOAD}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 200 " ]] || die "expected POST replay -> 200 but got: $h (URL=$BASE)"
body="$(resp_body "$resp")"
ORDER_ID_REPLAY="$(echo "$body" | jq -r '.data.id')"
[ "$ORDER_ID_REPLAY" = "$ORDER_ID" ] || die "expected same order id on idempotent replay"

ALT_QTY=1
ALT_SUBTOTAL="$(awk -v p="$PRODUCT_PRICE" -v q="$ALT_QTY" 'BEGIN{print p*q}')"
ALT_TOTAL="$(awk -v s="$ALT_SUBTOTAL" -v d="$DISCOUNT" -v f="$DELIVERY_FEE" 'BEGIN{print s+f-d}')"
PAYLOAD_ALT="$(jq -n \
  --arg customerName "Ada Lovelace" \
  --arg phone "+852-5555-0000" \
  --arg email "ada@example.com" \
  --arg productId "$PRODUCT_ID" \
  --arg productName "$PRODUCT_NAME" \
  --arg currency "HKD" \
  --arg note "Leave at counter (alt)" \
  --argjson unitPrice "$PRODUCT_PRICE" \
  --argjson quantity "$ALT_QTY" \
  --argjson subtotal "$ALT_SUBTOTAL" \
  --argjson total "$ALT_TOTAL" \
  '{
    customerName: $customerName,
    phone: $phone,
    email: $email,
    items: [{productId: $productId, name: $productName, unitPrice: $unitPrice, quantity: $quantity}],
    amounts: {subtotal: $subtotal, total: $total, currency: $currency},
    fulfillment: {type: "pickup"},
    note: $note
  }')"
resp="$(curl_resp -X POST -H "content-type: application/json" -H "x-idempotency-key: ${IDEM}" --data "${PAYLOAD_ALT}" "$BASE")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 409 " ]] || die "expected POST conflict -> 409 but got: $h (URL=$BASE)"
must_have_error_code "$resp" "CONFLICT"
must_have_request_id "$resp"
must_have_header "$resp" "x-request-id"
must_have_header "$resp" "content-type"

echo "OK: POST create -> 200"
echo "OK: POST replay same key+payload -> 200"
echo "OK: POST same key different payload -> 409 + CONFLICT"
echo

echo "== Orders 4) Admin list/get/update =="

resp="$(curl_resp -H "x-admin-secret: ${ADMIN_SECRET}" "$BASE?limit=10")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 200 " ]] || die "expected GET list -> 200 but got: $h (URL=$BASE)"
body="$(resp_body "$resp")"
echo "$body" | jq -e --arg id "$ORDER_ID" '.data.orders | map(.id) | index($id) != null' >/dev/null || die "expected order in list"

resp="$(curl_resp -H "x-admin-secret: ${ADMIN_SECRET}" "$BASE/$ORDER_ID")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 200 " ]] || die "expected GET by id -> 200 but got: $h (URL=$BASE/$ORDER_ID)"
body="$(resp_body "$resp")"
echo "$body" | jq -e --arg id "$ORDER_ID" '.data.id == $id' >/dev/null || die "expected order id match"

# 新單初始 status=PENDING（冇 paymentProof，見 orders route）。狀態機只准
# PENDING → PENDING_CONFIRMATION / CONFIRMED / CANCELLED（lib/orders/status-transitions），
# PENDING → PAID 唔係有效轉換 → 400。用 CONFIRMED 測 status-update 全路徑。
resp="$(curl_resp -X PATCH -H "content-type: application/json" -H "x-admin-secret: ${ADMIN_SECRET}" --data '{"status":"CONFIRMED"}' "$BASE/$ORDER_ID")"
h="$(echo "$resp" | sed -n "1p")"
[[ "$h" =~ " 200 " ]] || die "expected PATCH -> 200 but got: $h (URL=$BASE/$ORDER_ID)"
body="$(resp_body "$resp")"
echo "$body" | jq -e '.data.status == "CONFIRMED"' >/dev/null || die "expected status CONFIRMED"

echo "OK: GET list -> 200"
echo "OK: GET by id -> 200"
echo "OK: PATCH status -> 200"
echo
