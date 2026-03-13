# Async Report Download Guide (Industry Standard)

When generating reports asynchronously (via BullMQ), the file generation happens in the background. The frontend must be notified when the file is ready, and then securely download it.

Because our download endpoint (`GET /reports/download/:jobId`) requires authentication, we cannot use a simple `<a href="...">` link without either assuming cookies are universally sent or exposing the token in the URL.

Here is the industry standard approach for handling this in a modern React/Next.js SPA.

---

## The Complete Flow

1. **Initiate Request**: Frontend POSTs to `/reports/csv` (or PDF). Backend returns a `jobId`.
2. **Wait for Completion**:
   - **Option A (Push):** Frontend listens to Server-Sent Events (SSE). When the backend worker finishes, it emits a `REPORT_COMPLETED` event containing the `jobId`.
   - **Option B (Pull):** Frontend periodically polls `GET /reports/status/:jobId` until `status === 'completed'`.
3. **Secure Download (The Fetch + Blob Technique)**: Once notified, the frontend uses `fetch` to request the file securely, passing the JWT token. The response is converted into a `Blob` (Binary Large Object), and the browser is triggered to download it locally.

---

## Why Fetch + Blob? (The Industry Standard)

If you simply use `window.open('http://api.domain.com/reports/download/123')`, the browser will **not** attach your `Authorization: Bearer <token>` header.

While storing tokens in `HttpOnly` cookies solves this partially, it can still cause cross-origin (CORS) or SameSite cookie issues depending on your deployment architecture.

**The Fetch + Blob approach is universally secure and reliable:**

- It allows you to inject exactly the headers you need (`Authorization`).
- It allows you to catch REST API errors naturally (e.g., catching a `404 Not Found` if the file expired) and show a Toast notification, rather than opening an ugly JSON error in a new browser tab.

---

## Frontend Implementation Recipe

Here is the exact React function you should use to securely download the report when it is ready.

```javascript
import { apiClient } from '@/lib/auth/apiClient';

/**
 * Downloads a file securely using fetch + blob.
 * This ensures Authorization headers are sent and handles errors gracefully.
 *
 * @param {string} jobId - The UUID of the generated report job.
 * @param {string} filename - The desired local filename (e.g., 'report.csv')
 */
export async function downloadSecureReport(jobId, filename = 'report.csv') {
  try {
    // 1. Fetch the file using our pre-configured Axios/Fetch client
    // We specify responseType: 'blob' so Axios knows it's receiving binary data
    const response = await apiClient.get(`/reports/download/${jobId}`, {
      responseType: 'blob',
    });

    // 2. Extract the Blob containing the file data
    const blob = new Blob([response.data], {
      type: response.headers['content-type'] || 'application/octet-stream',
    });

    // 3. Create a temporary local Object URL for the browser
    const downloadUrl = window.URL.createObjectURL(blob);

    // 4. Create a hidden, temporary <a> tag to trigger the browser's download UI
    const link = document.createElement('a');
    link.href = downloadUrl;

    // Fallback filename if not provided, try to extract from Content-Disposition header
    let finalFilename = filename;
    const disposition = response.headers['content-disposition'];
    if (disposition && disposition.indexOf('attachment') !== -1) {
      const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(
        disposition,
      );
      if (matches != null && matches[1]) {
        finalFilename = matches[1].replace(/['"]/g, '');
      }
    }

    link.download = finalFilename;

    // 5. Append, click, and cleanup
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Memory cleanup: revoke the Object URL
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Failed to download report securely:', error);
    // Show a user-friendly toast notification here!
    throw new Error('Failed to download the generated report.');
  }
}
```

## Integrating with the UI

When a user clicks "Generate Report":

```javascript
// 1. Start generation
const { jobId } = await startReportGeneration(params);
showToast("Report generation started! We'll notify you when it's ready.");

// 2. Using SSE hook (as implemented in useSSE)
useSSE((event) => {
  if (event.type === 'REPORT_COMPLETED' && event.data.jobId === currentJobId) {
    showToast('Report ready! Downloading now...');
    // 3. Trigger secure browser download
    downloadSecureReport(event.data.jobId);
  }
});
```
