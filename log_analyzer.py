"""
Pro Log Analyzer (Sensing Layer)

Implements deterministic clustering (masking variable parts of log messages),
time-series metric extraction, simple statistical anomaly detection, and
prepares a compact context that the LLM (Reasoning Layer) can consume.
"""

import re
import json
from datetime import datetime
from collections import Counter
import statistics
from typing import List, Dict


class AdvancedLogAnalyzer:
    def __init__(self, raw_logs: str):
        self.raw_logs = raw_logs or ""
        # Normalize inputs that might be JSON or CSV into plain log lines
        normalized = self._normalize_input(self.raw_logs)
        self.lines = [l for l in normalized.strip().split('\n') if l.strip()]
        self.parsed_data: List[Dict] = []

    def _normalize_input(self, input_text: str) -> str:
        """Detect JSON or CSV payloads (often uploaded as text) and convert them
        into unified log-line strings so the parser can process them deterministically.
        """
        import json as _json, csv as _csv, io as _io

        # Try JSON
        try:
            parsed = _json.loads(input_text)
            lines = []
            if isinstance(parsed, dict):
                if 'logs' in parsed and isinstance(parsed['logs'], str):
                    return parsed['logs']
                ts = parsed.get('timestamp') or parsed.get('time') or ''
                lvl = parsed.get('level') or parsed.get('severity') or 'INFO'
                comp = parsed.get('component') or parsed.get('service') or ''
                msg = parsed.get('message') or parsed.get('msg') or _json.dumps(parsed)
                return f"[{ts}] [{lvl}] [{comp}] {msg}"
            if isinstance(parsed, list):
                for obj in parsed:
                    if isinstance(obj, dict):
                        ts = obj.get('timestamp') or obj.get('time') or ''
                        lvl = obj.get('level') or 'INFO'
                        comp = obj.get('component') or ''
                        msg = obj.get('message') or obj.get('msg') or _json.dumps(obj)
                        lines.append(f"[{ts}] [{lvl}] [{comp}] {msg}")
                    else:
                        lines.append(str(obj))
                return '\n'.join(lines)
        except Exception:
            pass

        # Try CSV
        try:
            if ',' in input_text and '\n' in input_text:
                buf = _io.StringIO(input_text)
                reader = _csv.DictReader(buf)
                lines = []
                for row in reader:
                    ts = row.get('timestamp') or row.get('time') or ''
                    lvl = row.get('level') or row.get('severity') or 'INFO'
                    comp = row.get('component') or ''
                    msg = row.get('message') or row.get('msg') or ' '.join([v for k,v in row.items() if v and k.lower() not in ('timestamp','level','component')])
                    lines.append(f"[{ts}] [{lvl}] [{comp}] {msg}")
                if lines:
                    return '\n'.join(lines)
        except Exception:
            pass

        return input_text

    def analyze(self):
        # 1. Parse Structure
        self._parse_lines()

        # 2. Pattern Recognition (Clustering)
        clusters = self._cluster_logs()

        # 3. Time Series Metrics Extraction
        metrics = self._extract_metrics()

        # 4. Anomaly Detection (Statistical)
        anomalies = self._detect_anomalies(metrics)

        # 5. Calculate Health Score
        health_score = self._calculate_health(clusters, anomalies)

        return {
            "parsed_entries": len(self.parsed_data),
            "log_levels": dict(Counter(entry['level'] for entry in self.parsed_data)),
            "components": list({entry['component'] for entry in self.parsed_data if entry.get('component')}),
            "metrics_summary": metrics,
            "anomalies": anomalies,
            "correlations": self._find_correlations(anomalies, clusters),
            "health_score": health_score,
            "analysis_ready_for_llm": self._prepare_llm_context(clusters, anomalies, metrics)
        }

    def _parse_lines(self):
        # Regex to capture Timestamp, Level, Component (optional), and Message
        log_pattern = re.compile(r"\[(.*?)\]\s+\[(\w+)\]\s+(?:\[(.*?)\]\s+)?(.*)")

        for line in self.lines:
            match = log_pattern.match(line.strip())
            if match:
                timestamp, level, component, message = match.groups()
                self.parsed_data.append({
                    "timestamp": timestamp,
                    "level": level,
                    "component": component or "System",
                    "message": message,
                    "raw": line
                })

    def _cluster_logs(self):
        clusters = {}

        # Regex to replace numbers, UUIDs, IPs with placeholders
        mask_patterns = [
            (r'\b\d+\.\d+\.\d+\.\d+\b', '{IP}'),      # IP Addresses
            (r'\b[0-9a-fA-F-]{36}\b', '{UUID}'),             # UUIDs
            (r"\b\d+\b", '{NUM}'),                       # Generic Numbers
            (r"'.*?'", "'{STR}'")                         # Quoted strings
        ]

        for entry in self.parsed_data:
            masked_msg = entry['message']
            for pattern, mask in mask_patterns:
                masked_msg = re.sub(pattern, mask, masked_msg)

            signature = f"[{entry['level']}] {masked_msg}"

            if signature not in clusters:
                clusters[signature] = {
                    "pattern": masked_msg,
                    "level": entry['level'],
                    "count": 0,
                    "example": entry['message'],
                    "timestamps": []
                }
            clusters[signature]["count"] += 1
            clusters[signature]["timestamps"].append(entry["timestamp"]) 

        # Return top 20 most frequent patterns (sorted)
        return sorted(clusters.values(), key=lambda x: x['count'], reverse=True)[:20]

    def _extract_metrics(self):
        """Extracts CPU, Memory, and Latency trends from logs and returns series."""
        cpu_values = []
        mem_values = []
        latency_values = []

        for entry in self.parsed_data:
            msg = entry['message']

            cpu_match = re.search(r'CPU:\s*(\d+)%', msg)
            if cpu_match:
                cpu_values.append(int(cpu_match.group(1)))

            mem_match = re.search(r'MEM:\s*(\d+)', msg)
            if mem_match:
                mem_values.append(int(mem_match.group(1)))

            lat_match = re.search(r'(?:Duration|latency|time):\s*(\d+)ms', msg, re.IGNORECASE)
            if lat_match:
                latency_values.append(int(lat_match.group(1)))

        metrics = {
            "avg_cpu": round(statistics.mean(cpu_values), 2) if cpu_values else 0,
            "max_cpu": max(cpu_values) if cpu_values else 0,
            "avg_memory": round(statistics.mean(mem_values), 2) if mem_values else 0,
            "max_latency": max(latency_values) if latency_values else 0,
            "metric_points": len(cpu_values),
            "cpu_series": cpu_values,
            "memory_series": mem_values,
            "latency_series": latency_values
        }

        return metrics

    def _detect_anomalies(self, metrics: Dict):
        anomalies = []
        if metrics.get('max_cpu', 0) > 80:
            anomalies.append(f"Critical CPU Spike detected: {metrics['max_cpu']}%")
        if metrics.get('max_latency', 0) > 2000:
            anomalies.append(f"High Latency detected: {metrics['max_latency']}ms")
        return anomalies

    def _find_correlations(self, anomalies, clusters):
        correlations = []
        has_latency = any('Latency' in a or 'Latency' in str(a) for a in anomalies)
        has_db_errors = any('database' in c['pattern'].lower() and c['level'] == 'ERROR' for c in clusters)

        if has_latency and has_db_errors:
            correlations.append('Strong correlation: Database Errors are likely causing Latency spikes.')

        return correlations

    def _calculate_health(self, clusters, anomalies):
        score = 100
        total_errors = sum(c['count'] for c in clusters if c['level'] in ['ERROR', 'CRITICAL'])

        score -= (total_errors * 5)
        score -= (len(anomalies) * 10)

        return max(0, score)

    def _prepare_llm_context(self, clusters, anomalies, metrics):
        return f"""
AUTOMATED ANALYSIS REPORT:

1. TOP LOG PATTERNS (Clustered):
{self._format_clusters(clusters)}

2. DETECTED METRICS:
- Max CPU: {metrics.get('max_cpu', 0)}%
- Max Latency: {metrics.get('max_latency', 0)}ms

3. DETECTED ANOMALIES:
{json.dumps(anomalies, indent=2)}
"""

    def _format_clusters(self, clusters):
        text = ""
        for c in clusters:
            text += f"- [{c['level']}] x{c['count']}: {c['pattern']}\n"
        return text

