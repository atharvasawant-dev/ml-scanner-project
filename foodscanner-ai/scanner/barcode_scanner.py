from __future__ import annotations

import time
from typing import Any

import cv2
import requests
from pyzbar.pyzbar import decode


API_URL = "http://127.0.0.1:8000/scan"


def _extract_barcode_value(data: Any) -> str | None:
    if data is None:
        return None
    if isinstance(data, bytes):
        try:
            return data.decode("utf-8").strip()
        except Exception:
            return None
    return str(data).strip()


def _print_result(payload: dict[str, Any]) -> None:
    product_name = ((payload.get("product") or {}).get("name"))
    health_score = ((payload.get("analysis") or {}).get("health_score"))
    final_decision = ((payload.get("decision") or {}).get("final_decision"))
    reasons = ((payload.get("decision") or {}).get("reasons"))

    print("\n--- Scan Result ---")
    print(f"Product: {product_name}")
    print(f"Health score: {health_score}")
    print(f"Final decision: {final_decision}")
    if isinstance(reasons, list):
        print("Reasons:")
        for r in reasons:
            print(f"- {r}")
    else:
        print(f"Reasons: {reasons}")


def main() -> None:
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam. Try changing the camera index (0, 1, 2...).")

    last_sent: str | None = None
    last_sent_ts = 0.0
    cooldown_seconds = 2.0

    print("Starting webcam barcode scanner...")
    print("- Press 'q' to quit")
    print(f"- API URL: {API_URL}")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.equalizeHist(gray)

        decoded = decode(gray)
        if not decoded:
            decoded = decode(frame)

        for barcode in decoded:
            x, y, w, h = barcode.rect
            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

            barcode_data = _extract_barcode_value(getattr(barcode, "data", None))
            if barcode_data:
                cv2.putText(
                    frame,
                    barcode_data,
                    (x, max(0, y - 10)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2,
                )

                now = time.time()
                if barcode_data != last_sent or (now - last_sent_ts) >= cooldown_seconds:
                    last_sent = barcode_data
                    last_sent_ts = now

                    try:
                        resp = requests.post(API_URL, json={"barcode": barcode_data}, timeout=20)
                        if resp.status_code >= 400:
                            print(f"\nAPI error {resp.status_code}: {resp.text}")
                        else:
                            payload = resp.json()
                            _print_result(payload)
                    except Exception as e:
                        print(f"\nRequest failed: {e}")

        cv2.imshow("FoodScanner AI - Barcode Scanner (press q to quit)", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
