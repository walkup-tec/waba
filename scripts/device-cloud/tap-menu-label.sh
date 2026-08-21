#!/bin/bash
# Usage: tap-menu-label.sh "Dispositivos conectados"
# NÃ£o faz force-stop (isso gerava toques/nav errados no meio do fluxo WABA).
set -e
SERIAL="${DEVICE_ADB_SERIAL:-127.0.0.1:5555}"
LABEL="${1:?label required}"
adb connect "$SERIAL" >/dev/null
adb -s "$SERIAL" shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
sleep 0.25
adb -s "$SERIAL" shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
sleep 0.25
adb -s "$SERIAL" shell am start -n com.whatsapp.w4b/com.whatsapp.Main >/dev/null 2>&1 || true
sleep 2.0
adb -s "$SERIAL" shell input tap 680 104
sleep 1.8
adb -s "$SERIAL" shell uiautomator dump /sdcard/uidump.xml >/dev/null
adb -s "$SERIAL" pull /sdcard/uidump.xml /tmp/waba-overflow.xml >/dev/null
export LABEL
python3 <<'PY'
import os, re, sys
label = os.environ["LABEL"]
xml = open("/tmp/waba-overflow.xml", encoding="utf-8", errors="ignore").read()
pat = re.compile(r'text="([^"]*)"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')
candidates = []
for m in pat.finditer(xml):
    t, x1, y1, x2, y2 = m.groups()
    if t.strip() != label:
        continue
    x1, y1, x2, y2 = map(int, (x1, y1, x2, y2))
    cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
    if cx < 280 or cy < 180:
        continue
    if (x2 - x1) < 120:
        continue
    candidates.append((cy, cx, t, x1, y1, x2, y2))
if not candidates:
    for m in pat.finditer(xml):
        t, x1, y1, x2, y2 = m.groups()
        if label.lower() not in t.lower():
            continue
        x1, y1, x2, y2 = map(int, (x1, y1, x2, y2))
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        if cx < 280 or cy < 180 or (x2 - x1) < 120:
            continue
        candidates.append((cy, cx, t, x1, y1, x2, y2))
if not candidates:
    texts = [m.group(1) for m in pat.finditer(xml) if m.group(1).strip()]
    print("NOT_FOUND")
    print("MENU:" + "|".join(texts[:50]))
    sys.exit(2)
candidates.sort(key=lambda r: r[0])
cy, cx, t, *_ = candidates[0]
print("OK", cx, cy)
open("/tmp/waba-overflow-xy.txt", "w").write("%d %d" % (cx, cy))
PY
read CX CY < /tmp/waba-overflow-xy.txt
adb -s "$SERIAL" shell input tap "$CX" "$CY" || true
sleep 1.5
echo TAPPED "$CX" "$CY"
FOCUS=$(adb -s "$SERIAL" shell dumpsys window 2>/dev/null | grep mCurrentFocus | head -n 1 || true)
echo "FOCUS:$FOCUS"
exit 0
