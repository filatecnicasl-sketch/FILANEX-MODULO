"""Check .es domains via NS record lookup (nslookup) - registered domains almost always have NS."""
import subprocess
import re

candidates = [
    "naxopro.es",
    "naxosystems.es",
    "naxosolutions.es",
    "naxoit.es",
    "naxoconnect.es",
    "naxotelecom.es",
    "gruponaxo.es",
    "tecnaxo.es",
    "naxoprotech.es",
    "naxopros.es",
    "naxotech.es",
    "naxosoft.es",
    "naxodigital.es",
    "naxoglobal.es",
    "naxonet.es",
]

def check_ns(domain):
    try:
        result = subprocess.run(
            ["nslookup", "-type=NS", domain, "8.8.8.8"],
            capture_output=True, text=True, timeout=15
        )
        out = result.stdout + result.stderr
        if "nameserver" in out.lower() or "servidor de nombres" in out.lower():
            return "REGISTRADO (tiene NS)"
        if "NXDOMAIN" in out or "Non-existent" in out or "no existe" in out.lower() or "can't find" in out.lower() or "no se encuentra" in out.lower():
            return "LIBRE (NXDOMAIN)"
        # SOA response without NS usually means exists at registry level
        if "primary name server" in out.lower() or "servidor de nombres principal" in out.lower():
            return "posible registro sin delegar"
        return f"INDETERMINADO: {out[:120]!r}"
    except Exception as e:
        return f"ERROR {type(e).__name__}"

print(f"{'DOMINIO':<22} ESTADO")
print("-" * 60)
for d in candidates:
    print(f"{d:<22} {check_ns(d)}")
