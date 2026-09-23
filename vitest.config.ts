import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    // Attendance date/weekday helpers build dates with `new Date("…T00:00:00")`
    // in the machine's local timezone — pin it so results don't depend on
    // where the tests happen to run.
    env: { TZ: "UTC" },
  },
});
