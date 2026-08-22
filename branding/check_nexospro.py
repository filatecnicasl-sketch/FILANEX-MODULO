"""Quick check: nexospro + nexos variants."""
import urllib.request
import subprocess

def check_com_rdap(domain):
    url = f"https://rdap.verisign.com/com/v1/domain/{domain}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return "OCUPADO"
    except urllib.error.HTTPError as e:
        return "LIBRE" if e.code == 404 else f"ERROR {e.code}"
    except Exception as e:
        return f"ERR {type(e).__name__}"

def check_es_ns(domain):
    try:
        result = subprocess.run(["nslookup", "-type=NS", domain, "8.8.8.8"],
                                capture_output=True, text=True, timeout=15)
        out = result.stdout + result.stderr
        if "nameserver" in out.lower() or "servidor de nombres" in out.lower():
            return "OCUPADO"
        if "NXDOMAIN" in out or "can't find" in out.lower() or "no se encuentra" in out.lower():
            return "LIBRE"
        return "INDET"
    except Exception as e:
        return f"ERR {type(e).__name__}"

for n in ["nexospro", "nexos"]:
    print(f"{n:<12} .com={check_com_rdap(n+'.com'):<10} .es={check_es_ns(n+'.es')}")
