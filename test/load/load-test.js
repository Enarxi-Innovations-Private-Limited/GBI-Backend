import http from 'k6/http';
import { sleep, check } from 'k6';

// Read configuration from environment or use defaults
const TARGET_URL = __ENV.TARGET_URL || 'https://api.gbiair.in';
const DASHBOARD_URL = __ENV.DASHBOARD_URL || 'https://gbiair.in/dashboard';
const LOGIN_EMAIL = __ENV.LOGIN_EMAIL || 'asyedabdulrahman3@gmail.com';
const LOGIN_PASSWORD = __ENV.LOGIN_PASSWORD || 'Syed@123';
const BYPASS_KEY = __ENV.BYPASS_KEY || 'your_very_secure_random_string_here';

export const options = {
  scenarios: {
    constant_request_rate: {
      executor: 'constant-arrival-rate',
      rate: 500,               // 500 requests per second
      timeUnit: '1s',
      duration: '5m',          // Run for 5 minutes
      preAllocatedVUs: 100,    // 100 Devices/VUs max
      maxVUs: 200,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],   // less than 1% failures
    http_req_duration: ['p(95)<1000'], // 95% of requests below 1000ms
  },
};

// Setup is run once before the VUs start
export function setup() {
  const loginPayload = JSON.stringify({
    email: LOGIN_EMAIL,
    password: LOGIN_PASSWORD,
  });

  const loginHeaders = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${TARGET_URL}/auth/login`, loginPayload, loginHeaders);
  
  check(res, {
    'login successful': (r) => r.status === 200,
  });

  if (res.status !== 200) {
    console.error(`Login failed with status ${res.status}. Body: ${res.body}`);
  }

  // The NestJS backend returns HttpOnly cookies. k6 automatically handles cookies 
  // in its cookie jar per VU. However, since setup() runs globally, we need to pass 
  // the cookies to the VUs or rely on the `Authorization` header if the backend supports it.

  // To be safe with Fastify cookies in k6, we extract the raw Set-Cookie strings.
  const cookies = res.headers['Set-Cookie'];
  let cookieString = '';

  if (Array.isArray(cookies)) {
    cookieString = cookies.map(c => c.split(';')[0]).join('; ');
  } else if (cookies) {
    cookieString = cookies.split(';')[0];
  }

  return { cookieString };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      // Attach the cookies retrieved during setup
      'Cookie': data.cookieString,
      // Add the bypass key to skip rate limiting on the API
      'x-load-test-bypass': BYPASS_KEY,
    },
  };

  // 1. Fetch the Dashboard Frontend HTML
  let resDashboard = http.get(DASHBOARD_URL);
  check(resDashboard, { 'GET Frontend status is 200': (r) => r.status === 200 });

  // 2. Get My Devices
  let res1 = http.get(`${TARGET_URL}/devices`, params);
  check(res1, { 'GET /devices status is 200': (r) => r.status === 200 });

  // 3. Get Chart Data (simulating dashboard load)
  const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const end = new Date().toISOString();
  
  // Note: GBIAIR1000 might not exist for this user in production. If it fails, 
  // we would need to dynamically fetch a deviceId from res1, but hardcoding provides consistent load.
  let res2 = http.get(`${TARGET_URL}/devices/chart-data?deviceIds=GBIAIR1000&parameter=pm25&start=${start}&end=${end}`, params);
  check(res2, { 'GET /devices/chart-data status is 200': (r) => r.status === 200 });

  sleep(Math.random() * 0.5 + 0.1);
}
