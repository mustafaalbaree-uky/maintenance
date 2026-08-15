#!/usr/bin/env bash
# End to end check against the local stack: signup, vehicle creation, provisioning,
# and RLS isolation between two users. Run with the stack up: supabase start
set -uo pipefail

API=${API:-http://127.0.0.1:54321}
# Tables live in their own schema, so PostgREST needs the profile headers.
SCHEMA=${SCHEMA:-maintenance}
PROFILE=(-H "Accept-Profile: $SCHEMA" -H "Content-Profile: $SCHEMA")
ANON=${ANON:-$(supabase status -o json 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin)['ANON_KEY'])")}

pass=0
fail=0
check() { # check <label> <actual> <expected>
  if [ "$2" = "$3" ]; then
    printf '  ok   %-52s %s\n' "$1" "$2"
    pass=$((pass + 1))
  else
    printf '  FAIL %-52s got %s, want %s\n' "$1" "$2" "$3"
    fail=$((fail + 1))
  fi
}

jq_len() { python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d) if isinstance(d,list) else 'error:'+json.dumps(d)[:120])"; }

signup() {
  curl -s "$API/auth/v1/signup" -H "apikey: $ANON" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"testpass12345\"}" |
    python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('access_token',''))"
}

get() { curl -s "$API/rest/v1/$1" -H "apikey: $ANON" -H "Authorization: Bearer $2" "${PROFILE[@]}"; }

STAMP=$(date +%s)
T1=$(signup "owner${STAMP}@example.com")
T2=$(signup "other${STAMP}@example.com")
[ -n "$T1" ] && [ -n "$T2" ] || { echo "signup failed"; exit 1; }

echo "Vehicle and provisioning"
V=$(curl -s "$API/rest/v1/vehicle" -H "apikey: $ANON" -H "Authorization: Bearer $T1" "${PROFILE[@]}" \
  -H 'Content-Type: application/json' -H 'Prefer: return=representation' \
  -d '{"year":2022,"make":"Genesis","model":"G70","trim":"3.3T AWD","drivetrain":"AWD",
       "purchase_date":"2026-08-15","purchase_odometer":42000,"plan_end_odometer":102000}' |
  python3 -c "import sys,json;d=json.load(sys.stdin);print(d[0]['id'] if isinstance(d,list) and d else '')")
check "vehicle created" "$([ -n "$V" ] && echo yes || echo no)" "yes"

curl -s "$API/rest/v1/rpc/provision_vehicle" -H "apikey: $ANON" -H "Authorization: Bearer $T1" "${PROFILE[@]}" \
  -H 'Content-Type: application/json' -d "{\"p_vehicle_id\":\"$V\"}" >/dev/null

check "maintenance items (12 universal + 6 g70)" "$(get 'maintenance_item?select=id' "$T1" | jq_len)" "18"
check "watch items"                             "$(get 'watch_item?select=id' "$T1" | jq_len)" "9"
check "tasks (7 first week + 12 baseline)"      "$(get 'task?select=id' "$T1" | jq_len)" "19"
check "warranties"                              "$(get 'warranty?select=id' "$T1" | jq_len)" "2"

echo "Templates are readable by any signed in user"
check "maintenance templates" "$(get 'maintenance_template?select=id' "$T2" | jq_len)" "18"
check "symptom refs"          "$(get 'symptom_ref?select=id' "$T2" | jq_len)" "12"

echo "RLS isolation"
check "other user sees no vehicles"          "$(get 'vehicle?select=id' "$T2" | jq_len)" "0"
check "other user sees no maintenance items" "$(get 'maintenance_item?select=id' "$T2" | jq_len)" "0"
check "other user sees no tasks"             "$(get 'task?select=id' "$T2" | jq_len)" "0"
check "other user sees no warranties"        "$(get 'warranty?select=id' "$T2" | jq_len)" "0"

echo "The MaxCare cap stays unresolved until he asks"
check "cap_is_total_odometer is null" \
  "$(get 'warranty?select=cap_is_total_odometer&name=eq.MaxCare' "$T1" |
     python3 -c "import sys,json;print(json.load(sys.stdin)[0]['cap_is_total_odometer'])")" "None"

echo "Odometer readings"
curl -s "$API/rest/v1/odometer_reading" -H "apikey: $ANON" -H "Authorization: Bearer $T1" "${PROFILE[@]}" \
  -H 'Content-Type: application/json' \
  -d "{\"vehicle_id\":\"$V\",\"reading_date\":\"2026-08-15\",\"miles\":42000}" >/dev/null
check "reading stored" "$(get 'odometer_reading?select=id' "$T1" | jq_len)" "1"

OTHER_WRITE=$(curl -s -o /dev/null -w '%{http_code}' "$API/rest/v1/odometer_reading" \
  -H "apikey: $ANON" -H "Authorization: Bearer $T2" "${PROFILE[@]}" -H 'Content-Type: application/json' \
  -d "{\"vehicle_id\":\"$V\",\"reading_date\":\"2026-08-16\",\"miles\":99999}")
check "other user cannot write to this vehicle" "$OTHER_WRITE" "403"

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
