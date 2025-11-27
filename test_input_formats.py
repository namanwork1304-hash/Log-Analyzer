from log_analyzer import AdvancedLogAnalyzer

# Sample raw log
raw = """[2025-11-27T14:00:00] [INFO] Application startup complete on port 8080.
[2025-11-27T14:00:01] [METRICS] CPU: 12% | MEM: 450MB | DB_CONN: 5
[2025-11-27T14:00:02] [ERROR] ConnectionTimeoutException: Database pool exhausted. Active connections: 50/50.
[2025-11-27T14:00:03] [METRICS] CPU: 89% | MEM: 1024MB | DB_CONN: 50 (MAX)
[2025-11-27T14:00:04] [CRITICAL] Garbage Collection (Stop-the-world) triggered. Duration: 1200ms.
"""

# Sample JSON array
json_input = '''[
  {"timestamp": "2025-11-27T14:01:00", "level": "INFO", "component": "auth", "message": "User 123 logged in"},
  {"timestamp": "2025-11-27T14:01:01", "level": "ERROR", "component": "db", "message": "Connection failed for user 123"},
  {"timestamp": "2025-11-27T14:01:02", "level": "ERROR", "component": "db", "message": "Connection failed for user 456"}
]'''

# Sample CSV
csv_input = """timestamp,level,component,message
2025-11-27T14:02:00,INFO,service,Started successfully
2025-11-27T14:02:01,METRICS,system,CPU: 78% | MEM: 600MB
2025-11-27T14:02:02,ERROR,db,Query execution time: 450ms (Threshold:200ms)
"""

for name, text in [('raw', raw), ('json', json_input), ('csv', csv_input)]:
    print('\n--- TEST:', name, '---')
    analyzer = AdvancedLogAnalyzer(text)
    result = analyzer.analyze()
    print('parsed_entries:', result['parsed_entries'])
    print('components:', result['components'])
    print('metrics_summary:', result['metrics_summary'])
    print('anomalies:', result['anomalies'])
    print('correlations:', result['correlations'])
