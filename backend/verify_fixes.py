import urllib.request
import urllib.parse
import json
import time

BASE_URL = "http://localhost:8001/api"

def make_request(endpoint, method="GET", data=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {'Content-Type': 'application/json'}
    
    if data:
        data_bytes = json.dumps(data).encode('utf-8')
    else:
        data_bytes = None
        
    req = urllib.request.Request(url, data=data_bytes, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            if response.status >= 200 and response.status < 300:
                resp_data = response.read().decode('utf-8')
                if resp_data:
                    return json.loads(resp_data)
                return {}
            else:
                print(f"Error: {response.status} {response.reason}")
                return None
    except urllib.error.HTTPError as e:
        print(f"HTTP Error: {e.code} {e.reason}")
        print(e.read().decode('utf-8'))
        return None
    except Exception as e:
        print(f"Request Error: {e}")
        return None

def test_voltage_classification():
    print("\n--- Testing Voltage Classification ---")
    
    # Ensure diagnosis is enabled
    print("Enabling diagnosis...")
    make_request("/diagnosis/settings", "POST", {"enabled": True, "notifications_enabled": True})
    
    # 1. Inject VD3 = 52V (Battery, Normal) and VD1 = 100V (PV, Low)
    line_vd3 = "VD3,52.0,100,-80"
    print(f"Injecting: {line_vd3}")
    make_request("/simulate", "POST", {"line": line_vd3})
    
    line_vd1 = "VD1,100.0,100,-80"
    print(f"Injecting: {line_vd1}")
    make_request("/simulate", "POST", {"line": line_vd1})
    
    time.sleep(2) # Wait for processing
    
    # Check alerts
    alerts = make_request("/alerts?limit=20")
    
    found_vd3_alert = False
    found_vd1_alert = False
    
    # Filter for recent alerts (last 10 seconds)
    # Timestamp format: 2025-12-03T02:25:48.123456
    current_time_str = time.strftime("%Y-%m-%dT%H:%M:%S")
    # Simple string comparison works for ISO format if we ignore sub-seconds or just check if it's very recent
    # Better: check if alert ID is very recent (high ID) or just look at the content carefully
    
    print("Checking recent alerts...")
    if alerts:
        for alert in alerts:
            # Check if alert is recent (created in this test run)
            # We can't easily parse time without datetime module, but we can assume top alerts are recent
            # Let's just print all active ones and manually verify logic or use a heuristic
            
            if not alert['resolved']:
                print(f"Active Alert: {alert['title']} - {alert['message']} (ID: {alert['id']})")
                
                # Only count as failure if it matches our specific test case
                # VD3 should NOT trigger "Low PV Voltage"
                if "VD3" in alert.get('component', '') and "Low PV Voltage" in alert['title']:
                    found_vd3_alert = True
                    print("!!! FOUND INCORRECT ALERT FOR VD3 !!!")
                
                # VD1 SHOULD trigger "Low PV Voltage"
                if "VD1" in alert.get('component', '') and "Low PV Voltage" in alert['title']:
                    found_vd1_alert = True
    
    if found_vd3_alert:
        print("FAILURE: VD3 (52V) triggered 'Low PV Voltage' alert.")
    else:
        print("SUCCESS: VD3 (52V) did NOT trigger 'Low PV Voltage' alert.")
        
    if found_vd1_alert:
        print("SUCCESS: VD1 (100V) triggered 'Low PV Voltage' alert.")
    else:
        print("FAILURE: VD1 (100V) did NOT trigger 'Low PV Voltage' alert.")

    # 2. Inject VD3 = 30V (Battery, Low)
    line_vd3_low = "VD3,30.0,100,-80"
    print(f"Injecting: {line_vd3_low}")
    make_request("/simulate", "POST", {"line": line_vd3_low})
    
    time.sleep(2)
    
    alerts = make_request("/alerts?limit=10")
    
    found_vd3_low = False
    if alerts:
        for alert in alerts:
            if not alert['resolved']:
                if "VD3" in alert.get('component', '') and "Low Battery Voltage" in alert['title']:
                    found_vd3_low = True
                    print(f"Found expected alert: {alert['title']} - {alert['message']}")
                
    if found_vd3_low:
        print("SUCCESS: VD3 (30V) triggered 'Low Battery Voltage'.")
    else:
        print("FAILURE: VD3 (30V) did not trigger 'Low Battery Voltage'.")

def test_alert_deletion():
    print("\n--- Testing Alert Deletion ---")
    
    # Get an active alert to delete
    alerts = make_request("/alerts?limit=10")
    
    active_alerts = [a for a in alerts if not a['resolved']] if alerts else []
    
    if not active_alerts:
        print("No active alerts to delete. Skipping deletion test.")
        return
        
    alert_to_delete = active_alerts[0]
    alert_id = alert_to_delete['id']
    print(f"Deleting alert ID: {alert_id} ({alert_to_delete['title']})")
    
    # Delete
    resp = make_request(f"/alerts/{alert_id}", "DELETE")
    print(f"Delete response: {resp}")
    
    # Verify
    alerts = make_request("/alerts?limit=50")
    
    deleted_alert = next((a for a in alerts if a['id'] == alert_id), None)
    
    if deleted_alert:
        print("Alert still exists in history.")
        if deleted_alert['resolved']:
            print("Alert is marked as resolved.")
        else:
            print("FAILURE: Alert is NOT marked as resolved.")
            
        # Check for deleted flag
        if 'deleted' in deleted_alert:
             print(f"Alert deleted flag: {deleted_alert['deleted']}")
             if deleted_alert['deleted']:
                 print("SUCCESS: Alert is marked as deleted.")
             else:
                 print("FAILURE: Alert is NOT marked as deleted.")
        else:
            print("WARNING: 'deleted' field not returned in API response. Check server.py.")
            
    else:
        print("FAILURE: Alert was permanently deleted (not found in history).")

if __name__ == "__main__":
    try:
        test_voltage_classification()
        test_alert_deletion()
    except Exception as e:
        print(f"Error: {e}")
