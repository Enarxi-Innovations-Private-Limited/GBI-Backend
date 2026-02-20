Product Requirements Document (PRD)
GBI – Air Quality Monitor Dashboard

1. Product Overview
Product Name
GBI Air Quality Monitor Dashboard
Company
GBI
Product Type
Web-based dashboard for air quality monitoring and device management
Supported Platforms
Web (Desktop only)
(Tablet and mobile responsive support are out of current scope)

2. Product Purpose
The GBI Air Quality Monitor Dashboard enables customers to monitor air quality data from GBI devices in real time and historically, configure alerts, and generate reports.
It also provides admins with centralized tools to register devices and manage users.

3. User Roles
3.1 Admin
Admins are responsible for:
Centralized device registration
Device management
User management
3.2 User
Users are responsible for:
Registering and managing their own devices
Viewing air quality data
Configuring alerts
Viewing graphs and reports
Managing their account

4. Authentication & User Onboarding
Supported Login Methods
Email & Password
Google OAuth
User Verification
Email verification using Email OTP (for email/password users)
Mobile number verification using Mobile OTP

5. Admin Portal Requirements

Admins can log in to the admin portal using hardcoded credentials.
5.1 Device Registration & Management
Admins can add devices to the system. Devices become claimable by users only after admin registration.

When the Add Device button is clicked, the admin must enter the Device ID. The Device Type is set by default to Air Quality Monitor.
Device Table Fields
Device ID
Assigned User (initially empty)
Device Status (Active / Inactive)
Device Added Date (date when admin added the device)
Device Assigned Date (date when user claimed the device)
Actions
Deassign Device (with confirmation)
Remove Device (with confirmation)
Additional Features
Search by Device ID
Confirmation dialogs for destructive actions

5.2 User Management
Admins can view and manage users.
User Table Fields
User Name
Organization
Phone Number
Email ID
Mobile number
city
Number of Devices
Actions
Restrict User (with confirmation)
Delete User (with confirmation)
Restrict user prevents login and device access

6. User Dashboard Requirements
6.1 Header & Navigation
Top Left
GBI Logo
Top Right
Refresh Button
Notifications Icon
Theme Toggle (Dark / Light)
Profile Menu

6.2 Profile Menu Options
Alert Groups
 Users can create device groups and configure threshold limits for each group. All devices added to a group will inherit the group's alert thresholds.
Edit Profile
 Users can edit their personal details, including name, email (only if signed up using the email/password method), mobile number, organization, and city.
Changing the email or mobile number requires OTP verification to the registered mobile number.


Users can reset their password by entering the current password, the new password, and re-entering the new password for confirmation.


Logout
 Users can securely log out of the system.
6.3 Dashboard
The dashboard displays air quality parameters and their values using a tile-based UI. Each tile shows:
The parameter name


The current value


Color-coded status


Severity expressed in clear, industry-standard terms: Good, Moderate, and Unhealthy


A graph section is also provided. When a user clicks on a graph, they are taken to a full-page graph view where they can:
Select a specific device


Choose a time range (start and end date/time)


View parameter trends over time


Compare the same parameter across multiple devices


7. Device Management (User Side)
Device Claiming
Users can claim a device by entering the Device ID, assigning a custom device name, and adding a location tag (for example, Living Room).
Validation Rules:
The device must exist in the admin-registered device registry.


The device must not already be assigned to another user.



Device Table (User View)
Device ID
Device Name
Location Tag (e.g., Living Room, Bedroom)
Device Status (Online / Offline / Deactivated)
Actions
Edit (Device Name, Location Tag only)
Deactivate Device (with confirmation)
Delete Device (with confirmation and data loss warning)

Device Groups
Users can organize their devices into groups to manage alert thresholds efficiently.
Group Actions:
Create Group (Name, Description)
Add/Remove Devices to/from Group
Set Alert Thresholds for the Group (applies to all devices in the group)
Delete Group (Devices become ungrouped)
Validation:
A device can be part of only one group at a time (to avoid conflicting thresholds).

8. Air Quality Data Dashboard
Parameters Displayed
PM2.5
PM10
TVOC
CO₂
Temperature
Humidity
Noise
Data View
Real-time readings

9. Graph & Visualization Features
Single Device Graph
User can select:
Device
Parameter (e.g., PM2.5)
Start date & time
End date & time
Graph displays parameter values over time

Device Comparison Graph
User can click Compare
Select another device
Compare the same parameter across two devices
Graph shows multiple lines for easy comparison

10. Alerts & Notifications
Alert Configuration
Alerts are configured at the **Device Group** level.
Users define threshold limits for parameters (e.g., CO2 > 1000) within a Group.
These thresholds apply automatically to all devices belonging to that Group.
Ungrouped devices rely on default system thresholds (or no alerts).
Alert Behavior
Alert triggered only when crossing threshold
No repeated alerts while value stays beyond limit
Alert triggered again when value goes back below threshold
Notification UI
Toast notifications (bottom-right)
Max 5 stacked toasts
Oldest toast removed if overflow
Stored notifications:
Last 10 notifications per user
Notifications shown in bell icon

11. Event Logs
Logged Events
Device Online / Offline
Threshold crossed (above / below)
Each event includes:
Timestamp
Device ID
Device Name
Event type
Relevant parameter and value (if applicable)

12. Reports
Report Generation
Users can:
Select devices
Select date & time range
Select parameters
Choose data interval:
3 minutes
5 minutes
10 minutes
Output Format
CSV or Excel (one format will be finalized)

13. Data Validation & Security
Backend validation of all incoming data
Frontend input is never trusted
Device data is validated before processing

14. Out of Scope (Current Phase)
The following are explicitly out of scope for the current phase:
Per-device alert thresholds
Generate report (Admin portal) - Generates report on users device datas
Graph to visulaize the users air qualities  (Admin Portal)
Payment gateway integration

Final Notes
This PRD:
Reflects only confirmed requirements
Keeps future enhancements clearly out of scope

