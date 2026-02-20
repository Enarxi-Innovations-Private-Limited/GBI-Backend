Product Requirements Document (PRD)

GBI Web Dashboard

This document defines the complete functional scope of the GBI Web Dashboard, covering both:

1.  User Portal
    

2.  Admin Portal
    

This PRD represents the unified and current functional definition of the system.

PART I – USER PORTAL

1. Overview

The User Portal enables customers to monitor air quality data from their registered GBI devices, configure thresholds, receive alerts, generate reports, and manage their account.

Platform Scope: Web (Desktop-first).

Mobile and tablet optimization are out of scope for the current phase.

2. Layout & Navigation

2.1 Sidebar (Left Navigation)

The sidebar contains:

-   GBI Logo
    

-   Company Name
    

Navigation Items:

-   My Dashboard
    

-   Device Management
    

-   Generate Report
    

-   Event Logs
    

-   Limit Settings
    

2.2 Top Header

The top header contains:

-   User greeting
    

-   Device search bar (used to select device for dashboard view)
    

-   Theme toggle (Dark / Light)
    

-   Notification bell icon
    

-   Golden Crown subscription icon
    

-   User name & profile icon
    

Golden Crown (Subscription Indicator)

When clicked, it displays:

-   Subscription type (Basic / Premium)
    

-   Remaining subscription days
    

-   Subscription expiry date
    

Profile Dropdown Contains:

-   Settings
    

-   Limit Settings (shortcut)
    

-   Logout
    

3. My Dashboard (Default Landing Page)

3.1 AQI & Parameter Tiles

Displays:

-   AQI
    

-   PM2.5
    

-   PM10
    

-   TVOC
    

-   CO2
    

-   Temperature
    

-   Humidity
    

-   Noise
    

Each tile shows:

-   Parameter name
    

-   Current value
    

-   Status indication
    

Data updates in real time at defined refresh intervals.

3.2 Real-Time Trend Chart

-   Displays live data for selected device
    

-   Updates continuously
    

3.3 Historical Date-Range Comparison (Same Device)

Users can compare historical data for the same device across two date ranges (e.g., Dec 1–31 vs Jan 1–31).

-   Comparison is shown in a single graph
    

-   Multiple lines with different colors
    

-   Applies to selected parameters
    

3.4 Device Comparison (Parameter-Based)

Users can click on any parameter tile (e.g., PM2.5) to open a detailed graph view.

In the graph view, users can:

-   Select presets (1 hour, 1 day, 1 week)
    

-   Select a custom date range
    

-   View trends for the selected parameter
    

Compare Devices:

-   User can select 2 or more devices
    

-   Same parameter and same date range
    

-   All devices displayed in a single graph
    

-   Each device represented with a different color
    

4. Device Management (User)

4.1 Device Status Overview

At the top of the page, three tiles show device counts:

-   Online Devices
    

-   Warning Devices
    

-   Offline Devices
    

4.2 Add Device

Users can add a device by clicking Add Device, which opens a modal requesting:

-   Device ID
    

-   Device Name
    

-   Location (user-defined alias, e.g., Living Room)
    

Validation Rules:

-   Device must be registered in the Admin Portal
    

-   Device must not already be claimed by another user
    

4.3 Device Table

Table columns:

-   Device ID
    

-   Device Name
    

-   Location
    

-   Status (Online / Offline / Warning)
    

Actions:

-   Edit (Device Name, Location only)
    

-   Delete (removes device from user account)
    

-   Restart Device (enabled only if device is online)
    

5. Generate Report

5.1 Device & Parameter Selection

Users can:

-   Select one or more devices
    

-   Select parameters:
    

-   PM2.5
    

-   PM10
    

-   CO₂
    

-   TVOC
    

-   Temperature
    

-   Humidity
    

-   Noise
    

-   Use Select All to choose all parameters
    

5.2 Date Range & Data Interval

Users select:

-   Start and end date
    

-   Data interval:
    

-   3 minutes
    

-   5 minutes
    

-   10 minutes
    

Data within the interval is averaged before being included in the report.

5.3 Report Output

Users can generate reports in:

-   CSV format
    

-   PDF format
    

PDF reports include:

-   GBI logo at the top
    

-   Selected devices, parameters, and date range
    

6. Event Logs

Two Sections:

6.1 Device Events

Columns:

-   Date & Time
    

-   Device Name
    

-   Device ID
    

-   Location
    

-   Status (Online / Offline / Warning)
    

6.2 Sensor Events

Columns:

-   Date & Time
    

-   Device Name
    

-   Parameter
    

-   Condition (Above / Below Threshold)
    

-   Parameter Value
    

7. Limit Settings

Accessible via Sidebar and Profile shortcut.

7.1 Group-Based Threshold Configuration

Users can:

-   Create Group
    

-   Add devices to group
    

-   Configure threshold values for parameters:
    

-   PM2.5
    

-   PM10
    

-   TVOC
    

-   CO₂
    

-   Temperature
    

-   Humidity
    

-   Noise
    

Thresholds apply to all devices in the group.

If threshold is breached:

-   Notification triggered
    

-   Sensor Event logged
    

7.2 Individual Device Threshold Configuration

For devices not in any group:

-   User sets thresholds per device
    

If threshold is breached:

-   Notification triggered
    

-   Sensor Event logged
    

8. Notifications

Two types of notifications:

8.1 Threshold-Based Notifications

-   Triggered when a parameter crosses a configured threshold (group-level or individual device-level)
    

-   Notification is triggered only on threshold crossing (no repeated alerts while value remains beyond limit)
    

-   When the parameter value returns to normal range, a new event is logged
    

-   Each threshold breach:
    

-   Triggers a user notification
    

-   Creates a Sensor Event log entry
    

8.2 Device Connectivity Notifications

If no data received for 3 consecutive cycles:

-   Device marked Offline
    

-   Notification triggered
    

-   Logged in Device Events
    

When device comes back Online:

-   Notification triggered
    

-   Logged in Device Events
    

9. Settings

Users can update:

-   Name
    

-   Email
    

-   Phone number
    

-   Organization
    

-   City
    

9.1 Password Change

Users must:

-   Enter current password
    

-   Enter new password
    

-   Re-enter new password for confirmation
    

10. Logout

-   Securely ends the user session
    

-   Redirects to login page
    

PART II – ADMIN PORTAL

11. Overview

Admin Portal provides centralized control for:

-   User management
    

-   Device registry management
    

-   Premium subscription management
    

No UI redesign or structural changes are permitted.

Authentication:

-   Hardcoded admin credentials
    

12. User Management (Admin)

Admin can view:

-   Total user count
    

User Table Columns:

-   User Name
    

-   Organization
    

-   Email
    

-   Subscription Type (Basic / Premium)
    

-   Premium Expiry Date (if Premium)
    

12.1 User Portal View (Read-Only Mode)

When Admin clicks a user:

Admin can:

-   View dashboard
    

-   View graphs & comparisons
    

-   View device counts
    

-   Generate reports
    

Admin cannot:

-   Modify devices
    

-   Edit thresholds
    

-   Delete devices
    

-   Change configurations
    

This is strictly read-only.

13. Device Management (Admin)

13.1 Add Device

-   Device ID must be unique
    

-   Duplicate IDs are not allowed
    

13.2 Device Table

Columns:

-   Device ID
    

-   Assignment Status (Assigned / Not Assigned)
    

-   Assigned User
    

Delete Rules:

-   If not assigned → Direct deletion
    

-   If assigned → Warning modal explaining:
    

-   User loses access
    

-   All associated data permanently deleted
    

-   Action irreversible
    

13.3 Bulk Device Upload (Excel)

Admin can upload Excel file containing Device IDs.

System will:

-   Parse IDs
    

-   Add valid new devices
    

-   Skip duplicates
    

-   Display summary of:
    

-   Successfully added
    

-   Failed due to duplication
    

Excel format details will be finalized separately.

13.4 Device Summary Tiles

Admin dashboard displays:

-   Total Devices
    

-   Online Devices
    

-   Offline Devices
    

-   Warning Devices
    

14. Premium Package & Subscription Management

Admin Portal must:

-   Maintain list of Premium users
    

-   Maintain expiry date for Premium users
    

-   Allow admin to set/control Premium pricing
    

All User Portal functionalities will be developed first.

After completion, Clients  Mr. Roop & Ms. Sanjana will decide which features fall under Premium.

Those features will be locked and accessible only to Premium users.

15. Deliverables

User Portal Deliverables

-   Real-time dashboard
    

-   Historical & comparison graphs
    

-   Device management
    

-   Threshold management (Group & Individual)
    

-   Notifications (Threshold + Connectivity)
    

-   Event logs
    

-   Report generation (CSV & PDF)
    

-   Subscription indicator (Golden Crown)
    

Admin Portal Deliverables

-   User management with subscription visibility
    

-   Read-only user portal access
    

-   Device registry management
    

-   Bulk device upload
    

-   Premium subscription control
