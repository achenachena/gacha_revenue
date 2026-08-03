import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    dashboard_reads: {
      executor: "ramping-vus",
      stages: [
        { duration: "30s", target: 25 },
        { duration: "2m", target: 100 },
        { duration: "30s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<250"],
  },
};

const baseURL = __ENV.API_BASE_URL || "http://localhost:8080/v1";

export default function dashboardReads() {
  const responses = http.batch([
    ["GET", `${baseURL}/games`],
    ["GET", `${baseURL}/revenue?grain=month`],
    ["GET", `${baseURL}/versions`],
  ]);
  for (const response of responses) {
    check(response, { "status is 200": (result) => result.status === 200 });
  }
  sleep(1);
}
