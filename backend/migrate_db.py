import sqlite3
import os

DB_FILE = 'pv_history.db'

def migrate():
    print(f"Migrating database {DB_FILE}...")
    try:
        conn = sqlite3.connect(DB_FILE)
        cursor = conn.cursor()
        
        # Check if column exists
        cursor.execute("PRAGMA table_info(diagnosis_settings)")
        columns = [info[1] for info in cursor.fetchall()]
        
        if 'notifications_enabled' not in columns:
            print("Adding notifications_enabled column...")
            cursor.execute('ALTER TABLE diagnosis_settings ADD COLUMN notifications_enabled BOOLEAN DEFAULT 1')
            conn.commit()
            print("Column added successfully.")
        else:
            print("Column notifications_enabled already exists.")
            
        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == "__main__":
    migrate()
