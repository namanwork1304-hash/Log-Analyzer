import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from langchain_openai import ChatOpenAI
import httpx
import json
from log_analyzer import AdvancedLogAnalyzer
from typing import List, Dict
import csv as _csv
import io as _io
import re
import statistics

# Initialize Flask App
app = Flask(__name__)
# Enable CORS to allow requests from your React frontend (usually localhost:3000 or 5173)
CORS(app)

# Initialize LangChain ChatOpenAI Client
client = httpx.Client(verify=False)
llm = ChatOpenAI(
    base_url="https://genailab.tcs.in",
    model="azure/genailab-maas-gpt-4o-mini",
    api_key="sk-JBIPJpgZRpuszGX2shenqw",
    http_client=client
)

# System Prompt
SYSTEM_PROMPT = """
You are an expert Performance Engineer AI. Your task is to analyze the provided raw application logs and metrics.
Identify performance bottlenecks, their severity, root causes, and suggest technical fixes.

You must output valid JSON only. No markdown formatting. Structure:
{
  "summary": "Brief executive summary of the performance state.",
  "overall_health_score": Number (0-100),
  "bottlenecks": [
    {
      "title": "Short title of the bottleneck",
      "severity": "Critical" | "High" | "Medium" | "Low",
      "description": "Detailed explanation of what is happening.",
      "root_cause": "The underlying technical reason (e.g., Missing Index, Memory Leak).",
      "recommendation": "Specific technical fix (e.g., 'Add composite index on col_a, col_b').",
      "affected_component": "Database" | "API" | "Infrastructure" | "Code"
    }
  ],
  "metrics_summary": {
    "cpu_peak": "XX%",
    "memory_peak": "XX MB/GB",
    "db_connections": "Current/Max"
  }
}
"""

@app.route('/api/analyze', methods=['POST'])
def analyze_logs():
    try:
        data = request.json
        raw_logs = data.get('logs', '')

        if not raw_logs:
            return jsonify({"error": "No logs provided"}), 400

        # Normalize input: support raw logs (text), JSON payloads, and CSV files uploaded as text
        def normalize_input(input_text: str) -> str:
            import json as _json, csv as _csv, io as _io

            # 1) Try JSON
            try:
                parsed = _json.loads(input_text)
                # If it's a dict with 'logs' or list of entries
                lines = []
                if isinstance(parsed, dict):
                    # If it contains a 'logs' field, use it
                    if 'logs' in parsed and isinstance(parsed['logs'], str):
                        return parsed['logs']
                    # Otherwise try to convert dict keys to a line
                    # Single-object -> format as one log line
                    ts = parsed.get('timestamp') or parsed.get('time') or parsed.get('date') or ''
                    lvl = parsed.get('level') or parsed.get('severity') or 'INFO'
                    comp = parsed.get('component') or parsed.get('service') or ''
                    msg = parsed.get('message') or parsed.get('msg') or _json.dumps(parsed)
                    return f"[{ts}] [{lvl}] [{comp}] {msg}"
                elif isinstance(parsed, list):
                    # Each element can be dict -> convert to line
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

            # 2) Try CSV (heuristic: contains comma and newline and header)
            try:
                if ',' in input_text and '\n' in input_text:
                    buf = _io.StringIO(input_text)
                    reader = _csv.DictReader(buf)
                    lines = []
                    for row in reader:
                        ts = row.get('timestamp') or row.get('time') or ''
                        lvl = row.get('level') or row.get('severity') or 'INFO'
                        comp = row.get('component') or ''
                        # prioritize message-like columns
                        msg = row.get('message') or row.get('msg') or ' '.join([v for k,v in row.items() if v and k.lower() not in ('timestamp','level','component')])
                        lines.append(f"[{ts}] [{lvl}] [{comp}] {msg}")
                    if lines:
                        return '\n'.join(lines)
            except Exception:
                pass

            # 3) Fallback: return original text
            return input_text

        normalized_logs = normalize_input(raw_logs)

        # Step 1: Advanced Analysis
        print("Starting advanced log analysis...")
        analyzer = AdvancedLogAnalyzer(normalized_logs)
        analysis = analyzer.analyze()
        print(f"Analysis complete. Found {len(analysis['anomalies'])} anomalies, {len(analysis['correlations'])} correlations")

        # Step 2: Prepare context for LLM
        context = analysis['analysis_ready_for_llm']
        enhanced_logs = f"{context}\n\n### Raw Logs:\n{raw_logs}"

        # Step 3: Call LLM with enriched, compact context (Sensing -> Reasoning)
        # We pass a single compact string; the LLM's job is reasoning (why/how), not parsing.
        llm_prompt = SYSTEM_PROMPT + "\n\nPlease reason about the following pre-analyzed report and produce the JSON structure described.\n\n" + context

        print("Sending enriched analysis to LLM (reasoning step)...")
        # ChatOpenAI.invoke can accept a string in this setup
        response = llm.invoke(llm_prompt)
        analysis_content = response.content if hasattr(response, 'content') else str(response)

        print(f"LLM analysis completed. Response length: {len(analysis_content)}")

        # Return combined result
        result = {
            "pre_analysis": {
                "parsed_entries": analysis['parsed_entries'],
                "log_levels": analysis['log_levels'],
                "components": analysis['components'],
                "metrics_summary": analysis['metrics_summary'],
                "anomalies_detected": len(analysis['anomalies']),
                "correlations_found": len(analysis['correlations']),
                "health_score": analysis['health_score']
            },
            "llm_analysis": json.loads(analysis_content) if isinstance(analysis_content, str) else analysis_content
        }

        return jsonify(result), 200

    except json.JSONDecodeError as e:
        error_msg = f"LLM response is not valid JSON: {str(e)}"
        print(f"Error: {error_msg}")
        return jsonify({"error": error_msg, "type": "json_parse_error"}), 500
        
    except Exception as e:
        error_msg = str(e)
        print(f"Error occurred: {error_msg}")
        
        return jsonify({
            "error": error_msg,
            "type": "backend_error",
            "hint": "Check API key validity and proxy server configuration"
        }), 500


@app.route('/api/analyze-multi', methods=['POST'])
def analyze_multi():
    """Accept multiple files (multipart/form-data). Classify files by extension and
    extract logs and metrics, correlate across files, then run pre-analysis and LLM reasoning.
    """
    try:
        # Expecting files field with multiple files
        uploaded = request.files.getlist('files')
        if not uploaded:
            return jsonify({"error": "No files uploaded"}), 400

        file_summaries = []
        log_texts: List[str] = []
        metrics_series = { 'cpu': [], 'memory': [], 'latency': [] }

        for f in uploaded:
            name = (f.filename or '').lower()
            try:
                raw = f.stream.read()
                # decode with fallback
                try:
                    text = raw.decode('utf-8')
                except Exception:
                    text = raw.decode('latin-1')
            except Exception:
                # If reading fails, skip
                file_summaries.append({ 'filename': f.filename, 'status': 'failed_read' })
                continue

            # classify
            if name.endswith('.csv'):
                # parse CSV and extract metric columns heuristically
                buf = _io.StringIO(text)
                reader = _csv.DictReader(buf)
                rows = list(reader)
                file_summaries.append({ 'filename': f.filename, 'type': 'csv', 'rows': len(rows) })
                # try to extract cpu/mem/latency from rows
                for row in rows:
                    # join row values to a line for analyzer too
                    combined = ' '.join([str(v) for v in row.values() if v])
                    log_texts.append(f"[{row.get('timestamp','')}] [METRICS] {combined}")
                    # cpu
                    cpu_m = None
                    for k in row:
                        if 'cpu' in k.lower() or 'cpu' in str(row.get(k,'')).lower():
                            m = re.search(r"(\d+)", str(row.get(k,'')))
                            if m:
                                cpu_m = int(m.group(1))
                                metrics_series['cpu'].append(cpu_m)
                                break
                    # memory
                    for k in row:
                        if 'mem' in k.lower() or 'memory' in k.lower():
                            m = re.search(r"(\d+)", str(row.get(k,'')))
                            if m:
                                metrics_series['memory'].append(int(m.group(1)))
                                break
                    # latency
                    for k in row:
                        if 'lat' in k.lower() or 'time' in k.lower():
                            m = re.search(r"(\d+)", str(row.get(k,'')))
                            if m:
                                metrics_series['latency'].append(int(m.group(1)))
                                break

            elif name.endswith('.json'):
                # hand off JSON text to analyzer normalization by adding raw
                file_summaries.append({ 'filename': f.filename, 'type': 'json' })
                log_texts.append(text)

            else:
                # treat as raw log/text file
                file_summaries.append({ 'filename': f.filename, 'type': 'log', 'bytes': len(text) })
                log_texts.append(text)

        # Merge collected log texts
        merged_logs = '\n'.join(log_texts)

        # Run AdvancedLogAnalyzer on merged logs
        analyzer = AdvancedLogAnalyzer(merged_logs)
        analysis = analyzer.analyze()

        # Merge metrics_series with analyzer-collected metrics if present
        analyzer_metrics = analysis.get('metrics_summary', {})
        # try to append cpu_series
        combined_cpu_series = list(analyzer_metrics.get('cpu_series', [])) + metrics_series.get('cpu', [])
        combined_mem_series = list(analyzer_metrics.get('memory_series', [])) + metrics_series.get('memory', [])
        combined_lat_series = list(analyzer_metrics.get('latency_series', [])) + metrics_series.get('latency', [])

        merged_metrics = {
            'cpu_series': combined_cpu_series,
            'memory_series': combined_mem_series,
            'latency_series': combined_lat_series,
            'max_cpu': max(combined_cpu_series) if combined_cpu_series else analyzer_metrics.get('max_cpu', 0),
            'max_latency': max(combined_lat_series) if combined_lat_series else analyzer_metrics.get('max_latency', 0),
            'avg_cpu': round(statistics.mean(combined_cpu_series),2) if combined_cpu_series else analyzer_metrics.get('avg_cpu',0)
        }

        # Prepare compact context for LLM
        compact_context = analysis.get('analysis_ready_for_llm','')
        compact_context += "\n\nAGGREGATED_METRICS:\n"
        compact_context += f"- cpu_points: {len(combined_cpu_series)}, max_cpu: {merged_metrics['max_cpu']}, avg_cpu: {merged_metrics['avg_cpu']}\n"
        compact_context += f"- latency_points: {len(combined_lat_series)}, max_latency: {merged_metrics['max_latency']}\n"

        # Call LLM for reasoning
        llm_prompt = SYSTEM_PROMPT + "\n\nPlease reason about the following pre-analyzed report and produce the JSON structure described.\n\n" + compact_context
        response = llm.invoke(llm_prompt)
        analysis_content = response.content if hasattr(response, 'content') else str(response)

        # Build response
        result = {
            'files': file_summaries,
            'pre_analysis': {
                'parsed_entries': analysis['parsed_entries'],
                'log_levels': analysis['log_levels'],
                'components': analysis['components'],
                'metrics_summary': merged_metrics,
                'anomalies': analysis['anomalies'],
                'correlations': analysis['correlations'],
                'health_score': analysis['health_score']
            },
            'llm_analysis': json.loads(analysis_content) if isinstance(analysis_content, str) else analysis_content
        }

        return jsonify(result), 200

    except Exception as e:
        print('analyze_multi error', str(e))
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Run on port 5000
    app.run(port=5000, debug=True)