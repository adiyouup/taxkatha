/** Loads .env.local then .env for CLI scripts (Next.js does this itself at runtime). */
for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // file is optional
  }
}

export {};
