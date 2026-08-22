"""Verify RDAP responses are real - test a few 'OCUPADO' names + a control."""
import urllib.request
import json

def check_detail(domain):
    url = f"https://rdap.verisign.com/com/v1/domain/{domain}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
            events = {e.get('eventAction'): e.get('eventDate') for e in data.get('events', [])}
            status = data.get('status', [])
            return f"REGISTRADO reg={events.get('registration','?')[:10]} exp={events.get('expiration','?')[:10]} status={status[:2]}"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "LIBRE (404)"
        return f"HTTP {e.code}"
    except Exception as e:
        return f"ERR {type(e).__name__}: {e}"

tests = ["qodexo.com", "zynexo.com", "codaxo.com", "neuraxo.com",
         "xkjqwzv923abc.com",  # control: definitely free
         "google.com"]          # control: definitely taken

for t in tests:
    print(f"{t:<22} {check_detail(t)}")
