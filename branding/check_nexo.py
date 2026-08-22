"""Check nexo* domains: .com via RDAP + .es via NS lookup."""
import urllib.request
import subprocess

def check_com_rdap(domain):
    url = f"https://rdap.verisign.com/com/v1/domain/{domain}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as r:
            return "OCUPADO"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return "LIBRE"
        return f"ERROR {e.code}"
    except Exception as e:
        return f"ERROR {type(e).__name__}"

def check_es_ns(domain):
    try:
        result = subprocess.run(
            ["nslookup", "-type=NS", domain, "8.8.8.8"],
            capture_output=True, text=True, timeout=15
        )
        out = result.stdout + result.stderr
        if "nameserver" in out.lower() or "servidor de nombres" in out.lower():
            return "OCUPADO"
        if "NXDOMAIN" in out or "Non-existent" in out or "can't find" in out.lower() or "no se encuentra" in out.lower():
            return "LIBRE"
        if "primary name server" in out.lower():
            return "posible registro sin delegar"
        return "INDETERMINADO"
    except Exception as e:
        return f"ERROR {type(e).__name__}"

names = [
    "nexopro",
    "nexosystems",
    "nexosolutions",
    "gruponexo",
    "nexoconnect",
    "nexotelecom",
    "nexoit",
    "nexotech",
    "nexosoft",
    "nexodigital",
    "nexoglobal",
    "nexonet",
    "tecnexo",
    "nexoprotech",
    "nexoinformatica",
    "nexotecnologia",
    "nexointegra",
    "nexoservicios",
]

print(f"{'NOMBRE':<20} {'.COM':<12} {'.ES':<12}")
print("-" * 46)
results = []
for n in names:
    com = check_com_rdap(f"{n}.com")
    es = check_es_ns(f"{n}.es")
    results.append((n, com, es))
    print(f"{n:<20} {com:<12} {es:<12}")

print()
print("=== AMBOS LIBRES ===")
for n, com, es in results:
    if com == "LIBRE" and es == "LIBRE":
        print(f"  {n}.com + {n}.es")
