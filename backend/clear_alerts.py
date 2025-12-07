import urllib.request
import json

BASE_URL = "http://localhost:8000/api"

def get_active_alerts():
    try:
        url = f"{BASE_URL}/alerts?limit=100"
        with urllib.request.urlopen(url) as response:
            if response.status == 200:
                alerts = json.loads(response.read().decode('utf-8'))
                return [a for a in alerts if not a['resolved']]
    except Exception as e:
        print(f"Error fetching alerts: {e}")
        return []

def resolve_alert(alert_id):
    # We don't have a direct "resolve" endpoint exposed in the API snippet I saw earlier,
    # but we have a delete endpoint which does soft-delete (resolves + deletes).
    # The user might want to keep history, so "delete" is actually what we implemented as soft-delete.
    # Let's use the delete endpoint which now does: deleted=1, resolved=1.
    # This removes them from active view and stops flashing.
    try:
        url = f"{BASE_URL}/alerts/{alert_id}"
        req = urllib.request.Request(url, method="DELETE")
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print(f"Resolved/Deleted alert {alert_id}")
                return True
    except Exception as e:
        print(f"Error resolving alert {alert_id}: {e}")
        return False

def main():
    print("Fetching active alerts...")
    active_alerts = get_active_alerts()
    print(f"Found {len(active_alerts)} active alerts.")
    
    for alert in active_alerts:
        print(f"Resolving: {alert['title']} - {alert['message']} (ID: {alert['id']})")
        resolve_alert(alert['id'])
        
    print("Done.")

if __name__ == "__main__":
    main()
