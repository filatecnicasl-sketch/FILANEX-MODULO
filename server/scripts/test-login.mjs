import "dotenv/config";

const EMAIL = "stress.test@filanex.local";
const PASS = "StressTest123!";

async function main() {
  const login = await fetch("http://localhost:4700/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  console.log("Login:", login.status, await login.text());
}

main();
