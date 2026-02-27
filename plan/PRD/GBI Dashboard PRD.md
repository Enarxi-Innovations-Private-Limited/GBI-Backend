```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
# Product Requirements Document (PRD)

# GBI Web Dashboard

This document defines the complete functional scope of the GBI Web Dashboard,
covering both:

1. User Portal
2. Admin Portal

This PRD represents the unified and current functional definition of the system.

# PART I – USER PORTAL

## 1. Overview

The User Portal enables customers to monitor air quality data from their registered GBI
devices, configure thresholds, receive alerts, generate reports, and manage their
account.

Platform Scope: Web (Desktop-first).

Mobile and tablet optimization are out of scope for the current phase.


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
## 2. User Authentication & Onboarding

### 2.1 Supported Authentication Methods

Users can access the platform using:

- Email and Password
- Google OAuth

### 2. 2 Sign-Up Flow – Email & Password

#### Step 1: Account Creation

User provides:

- Email address
- Password

#### Step 2: Email Verification

- An OTP is sent to the registered email address.
- User must enter the OTP to verify the email.
- Until verified, the account remains inactive.

#### Step 3: Complete Profile

After email verification, the user is redirected to the **Complete Profile** screen.

User must provide:

- Name
- Organization
- City
- Phone Number


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
Notes:

- Email field is auto-filled.
- Email cannot be edited at this stage.

#### Step 4: Phone Number Verification

- An OTP is sent to the provided phone number.
- User must verify the OTP.
- Only after successful phone verification can the user access the dashboard.

#### Access Condition

The user can access the GBI Web Dashboard only after:

- Email verification is complete
- Profile details are completed
- Phone number verification is successful

### 2.3 Sign-Up Flow – Google OAuth

When a user signs up using Google:

- Email verification is considered complete (handled by Google).
- User is redirected to the Complete Profile screen.
- User must enter:
    o Name (if not auto-fetched)
    o Organization
    o City
    o Phone Number
- Phone number OTP verification is mandatory.

Only after phone verification can the user access the dashboard.


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
### 2.4 Login Flow

Users can log in using:

- Email and Password
- Google OAuth

Conditions:

- Email must be verified (for email/password users).
- Phone number must be verified.
- Account must not be restricted.

## 3. Layout & Navigation

#### 3 .1 Sidebar (Left Navigation)

The sidebar contains:

- GBI Logo
- Company Name

Navigation Items:

- My Dashboard
- Device Management
- Generate Report
- Event Logs
- Limit Settings


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
#### 3 .2 Top Header

The top header contains:

- User greeting
- Device search bar (used to select device for dashboard view)
- Theme toggle (Dark / Light)
- Notification bell icon
- Golden Crown subscription icon
- User name & profile icon

**_Golden Crown (Subscription Indicator)_**

When clicked, it displays:

- Subscription type (Basic / Premium)
- Remaining subscription days
- Subscription expiry date

**_Profile Dropdown Contains:_**

- Settings
- Limit Settings (shortcut)
- Logout

## 4. My Dashboard (Default Landing Page)

#### 4 .1 AQI & Parameter Tiles

Displays:

- Calculated AQI
- PM2.


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
##### • PM

##### • TVOC

##### • CO

- Temperature
- Humidity
- Noise

Each tile shows:

- Parameter name
- Current value
- Status indication

Data updates in real time at defined refresh intervals.

#### 4 .2 Real-Time Trend Chart

- Displays live data for selected device
- Updates continuously

#### 4 .3 Historical Date-Range Comparison (Same Device)

Users can compare historical data for the **same device** across two date ranges (e.g.,
Dec 1–31 vs Jan 1–31).

- Comparison is shown in a single graph
- Multiple lines with different colors
- Applies to selected parameters


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
#### 4 .4 Device Comparison (Parameter-Based)

Users can click on any parameter tile (e.g., PM2.5) to open a detailed graph view.

In the graph view, users can:

- Select presets (1 hour, 1 day, 1 week)
- Select a custom date range
- View trends for the selected parameter

**Compare Devices:**

- User can select 2 or more devices
- Same parameter and same date range
- All devices displayed in a single graph
- Each device represented with a different color

## 5. Device Management (User)

#### 5 .1 Device Status Overview

At the top of the page, three tiles show device counts:

- Online Devices
- Warning Devices
- Offline Devices

#### 5 .2 Add Device

Users can add a device by clicking **Add Device** , which opens a modal requesting the
following details:

- **Device ID**
- **Device Name**


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
- **Geo Location**
    o City (text field)
    o Pincode (text field – must be a 6-digit numeric value)
- **Location** (user-defined alias, e.g., Living Room)

**Validation Rules:**

- The Device ID must be registered in the Admin Portal.
- The device must not already be claimed by another user.
- The pincode must be exactly 6 digits and contain only numeric characters.

#### 5 .3 Device Table

Table columns:

- Device ID
- Device Name
- Location
- Status (Online / Offline / Warning)

Actions:

- Edit (Device Name, Location only)
- Delete (removes device from user account)
- Restart Device (enabled only if device is online)

## 6. Generate Report

#### 6 .1 Device & Parameter Selection

Users can:


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
- Select one or more devices
- Select parameters:
     PM2.
     PM
     CO₂
     TVOC
     Temperature
     Humidity
     Noise
- Use **Select All** to choose all parameters

#### 6 .2 Date Range & Data Interval

Users select:

- Start and end date
- Data interval:
     3 minutes
     5 minutes
     10 minutes

Data within the interval is averaged before being included in the report.

#### 6 .3 Report Output

Users can generate reports in:

- CSV format
- PDF format

PDF reports include:


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
- GBI logo at the top
- Selected devices, parameters, and date range

## 7. Event Logs

Two Sections:

#### 7 .1 Device Events

Columns:

- Date & Time
- Device Name
- Device ID
- Location
- Status (Online / Offline / Warning)

#### 7 .2 Sensor Events

Columns:

- Date & Time
- Device Name
- Parameter
- Condition (Above / Below Threshold)
- Parameter Value

## 8. Limit Settings

Accessible via Sidebar and Profile shortcut.


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
#### 8 .1 Group-Based Threshold Configuration

Users can:

- Create Group
- Add devices to group
- Configure threshold values for parameters:
     PM2.
     PM
     TVOC
     CO₂
     Temperature
     Humidity
     Noise

Thresholds apply to all devices in the group.

If threshold is breached:

- Notification triggered
- Sensor Event logged

#### 8 .2 Individual Device Threshold Configuration

For devices not in any group:

- User sets thresholds per device

If threshold is breached:

- Notification triggered
- Sensor Event logged


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
## 9. Notifications

Two types of notifications:

#### 9 .1 Threshold-Based Notifications

- Triggered when a parameter crosses a configured threshold (group-level or
    individual device-level)
- Notification is triggered only on threshold crossing (no repeated alerts while
    value remains beyond limit)
- When the parameter value returns to normal range, a new event is logged
- Each threshold breach:
     Triggers a user notification
     Creates a Sensor Event log entry

#### 9 .2 Device Connectivity Notifications

A device will be marked Offline if no data is received within a system-configured
inactivity duration. When connectivity is restored, the device will be marked Online.

- Device marked Offline
- Notification triggered
- Logged in Device Events

When device comes back Online:

- Notification triggered
- Logged in Device Events

## 10. Settings

Users can update:


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
- Name
- Organization
- City

#### 10 .1 Password Change

Users must:

- Enter current password
- Enter new password
- Re-enter new password for confirmation

## 11. Logout

- Securely ends the user session
- Redirects to login page

# PART II – ADMIN PORTAL

## 12. Overview

Admin Portal provides centralized control for:

- User management
- Device registry management
- Premium subscription management

No UI redesign or structural changes are permitted.


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
### 13. Authentication

- The Admin Portal will use **Email and Password authentication**.
- Only **one Admin account** will be created for the system.

#### Admin Account Configuration

The Admin account must include:

- Primary Email
- Recovery Email
- Phone Number

#### Password Recovery Process

If the Admin password is compromised or forgotten:

- The system will provide an option to send an OTP to either:
    o The registered Primary/Recovery Email, or
    o The registered Phone Number
- After successful OTP verification, the Admin will be allowed to set a new
    password.

## 14. User Management (Admin)

Admin can view:

- Total user count

User Table Columns:

- User Name
- Organization
- Email


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
- Subscription Type (Basic / Premium)
- Premium Expiry Date (if Premium)

#### 14 .1 User Portal View (Read-Only Mode)

When Admin clicks a user:

Admin can:

- View dashboard
- View graphs & comparisons
- View device counts
- Generate reports

Admin cannot:

- Modify devices
- Edit thresholds
- Delete devices
- Change configurations

This is strictly read-only.

## 15. Device Management (Admin)

#### 15 .1 Add Device

- Device ID must be unique
- Duplicate IDs are not allowed


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
#### 15 .2 Device Table

The Device Table will display the following columns:

- **Device ID**
- **Assignment Status** (Assigned / Not Assigned)
- **Assigned User**
- **Device Location**
    o City
    o Pincode

```
Device Location (City & Pincode) is captured from the User during device
claiming and displayed for administrative visibility.
```
Delete Rules:

- If not assigned → Direct deletion
- If assigned → Warning modal explaining:
    o User loses access
    o All associated data permanently deleted
    o Action irreversible

#### 15 .3 Bulk Device Upload (Excel)

Admin can upload Excel file containing Device IDs.

System will:

- Parse IDs
- Add valid new devices
- Skip duplicates
- Display summary of:
    o Successfully added
    o Failed due to duplication


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
Excel format details will be finalized separately.

#### 15 .4 Device Summary Tiles

Admin dashboard displays:

- Total Devices
- Online Devices
- Offline Devices
- Warning Devices

## 16. Premium Package & Subscription Management

### Admin Portal capabilities:

- Admin can set and update Premium subscription pricing.
- Admin can view successful payment records in a payment summary table.
- The system automatically activates Premium access upon successful payment.
- The system automatically calculates and manages subscription expiry based on
    the payment date and plan duration.
- Admin can view subscription end dates for users (read-only visibility).

### Premium Feature Access Model

All User Portal functionalities will be developed first.

After completion, Clients **Mr. Roop & Ms. Sanjana** will decide which of the completed
features will be categorized as Premium features.

Premium access will follow a strict **Enable / Disable model** :


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
- A feature is either fully available or fully restricted.
- No usage limits, counters, quotas, or partial access rules will be implemented.

Examples:

- Excel download available only for Premium users.
- Custom graph functionality available only for Premium users.
- If a feature is marked as Premium, Basic users will not have access to it at all.

There will be no conditional limitations such as:

- Limiting the number of reports per day for Basic users.
- Providing reduced usage counts for non-Premium users.

The Premium logic will be strictly binary (Yes / No access), with no complexity beyond
feature enablement control.

## 17. Deliverables

#### User Portal Deliverables

- Real-time dashboard
- Historical & comparison graphs
- Device management
- Threshold management (Group & Individual)
- Notifications (Threshold + Connectivity)
- Event logs
- Report generation (CSV & PDF)
- Subscription indicator (Golden Crown)


```
No 23, Sripuram colony 1st street, Viralur,
Saint Thomas mount, Chennai , 600016
Tel: +91-4442076267,
Email: info@enarxi.com, http://www.enarxi.com.
CIN: U29305TN2021PTC
```
#### Admin Portal Deliverables

- User management with subscription visibility
- Read-only user portal access
- Device registry management
- Bulk device upload
- Premium subscription control


