"""Check domain availability via RDAP (.com reliable) and DNS (.es indicative)."""
import urllib.request
import socket
import json
import sys

def check_com_rdap(domain):
    """RDAP for .com - 404 means available."""
    url = f"https://rdap.verisign.com/com/v1/domain/{domain}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return "REGISTRADO"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "LIBRE"
        return f"ERROR {e.code}"
    except Exception as e:
        return f"ERROR {type(e).__name__}"

def check_dns(domain):
    """DNS resolution - if resolves, it's taken. If not, likely available (not guaranteed)."""
    try:
        socket.setdefaulttimeout(5)
        socket.getaddrinfo(domain, None)
        return "REGISTRADO (resuelve DNS)"
    except socket.gaierror:
        return "posiblemente libre (no resuelve)"
    except Exception as e:
        return f"ERROR {type(e).__name__}"

names = [
    "naxopro",
    "naxotech",
    "naxosoft",
    "naxosystems",
    "naxodigital",
    "naxoglobal",
    "naxosolutions",
    "naxoit",
    "naxonet",
    "naxoconnect",
    "naxotelecom",
    "gruponaxo",
    "tecnaxo",
    "naxoprotech",
    "naxopros",
]

print(f"{'NOMBRE':<18} {'.COM (RDAP)':<22} {'.ES (DNS)':<30}")
print("-" * 70)
for n in names:
    com = check_com_rdap(f"{n}.com")
    es = check_dns(f"{n}.es")
    print(f"{n:<18} {com:<22} {es:<30}")
