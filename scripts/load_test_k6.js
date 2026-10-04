import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "10s", target: 50 },  # Ramp-up to 50 users
    { duration: "30s", target: 200 }, # Sustain 200 virtual users
    { duration: "10s", target: 0 },   # Ramp-down
  ],
  thresholds: {
    http_req_duration: ["p(95)<500"], # 95% of requests must complete below 500ms
    http_req_failed: ["rate<0.01"],   # Less than 1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";

export default function () {
  // 1. Health Check
  const healthRes = http.get(`${BASE_URL}/api/health/`);
  check(healthRes, {
    "health check status 200": (r) => r.status === 200,
  });

  // 2. Fetch Courses List
  const coursesRes = http.get(`${BASE_URL}/api/courses/`);
  check(coursesRes, {
    "courses list status 200": (r) => r.status === 200,
  });

  sleep(1);
}
