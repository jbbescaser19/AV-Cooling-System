
*** Settings ***
Documentation    AV Cooling System Management Tests
Library          SeleniumLibrary
Library          OperatingSystem
Test Setup       Open Browser    ${BASE_URL}    ${BROWSER}
Test Teardown    Close Browser

*** Variables ***
${BASE_URL}      http://localhost:5173
${BROWSER}       chrome

*** Test Cases ***
01 - Owner Dashboard
    Login As Owner
    Check Management Page    /management/dashboard    Business dashboard

02 - POS
    Login As Owner
    Check Management Page    /management/pos    Walk-in product sales

03 - Orders
    Login As Owner
    Check Management Page    /management/orders    All orders

04 - Service Requests
    Login As Owner
    Check Management Page    /management/service-requests    Service requests

05 - Payments
    Login As Owner
    Check Management Page    /management/payments    Payments

06 - Products And Inventory
    Login As Owner
    Check Management Page    /management/products    Products
    Check Management Page    /management/variants    Variants
    Check Management Page    /management/categories    Categories
    Check Management Page    /management/inventory    Inventory
    Check Management Page    /management/stock-movements    Stock Movements

07 - Booking Calendar
    Login As Owner
    Check Management Page    /management/booking-calendar    Booking Calendar

08 - Technician Availability
    Login As Owner
    Check Management Page    /management/schedules    Technician Availability

09 - Completed Jobs History
    Login As Owner
    Check Management Page
    ...    /management/installation-history
    ...    Completed Jobs History

10 - Facebook Agreements
    Login As Owner
    Check Management Page    /management/facebook-requests    Facebook

11 - Reports
    Login As Owner
    Check Management Page    /management/reports    Reports

12 - Feedback And Sentiment Analysis
    Login As Owner
    Check Management Page    /management/feedback    Feedback & Sentiment

13 - Capacity Calculator
    Login As Owner
    Check Management Page
    ...    /management/capacity-calculator
    ...    Aircon Capacity Calculator

14 - Staff Accounts
    Login As Owner
    Check Management Page    /management/staff    Staff

15 - Archive
    Login As Owner
    Check Management Page    /management/archive    Archive

16 - Audit Logs
    Login As Owner
    Check Management Page    /management/audit-logs    Audit

17 - Customers
    Login As Owner
    Check Management Page    /management/customers    Customers

18 - Notifications
    Login As Owner
    Check Management Page    /management/notifications    Notifications

19 - Service Types
    Login As Owner
    Check Management Page    /management/service-types    Service Types

20 - Technicians
    Login As Owner
    Check Management Page    /management/technicians    Technicians

*** Keywords ***
Login As Owner
    ${email}=    Get Environment Variable    OWNER_EMAIL    ${EMPTY}
    ${password}=    Get Environment Variable    OWNER_PASSWORD    ${EMPTY}
    Skip If    not $email or not $password
    ...    Set OWNER_EMAIL and OWNER_PASSWORD first.

    Go To    ${BASE_URL}/management/login

    Wait Until Element Is Visible
    ...    css:input[type="email"]
    ...    15s

    Input Text
    ...    css:input[type="email"]
    ...    ${email}

    Input Password
    ...    css:input[type="password"]
    ...    ${password}

    Click Button    css:button[type="submit"]

    Wait Until Location Is
    ...    ${BASE_URL}/management/dashboard
    ...    20s

Check Management Page
    [Arguments]    ${path}    ${expected_text}

    Go To    ${BASE_URL}${path}

    Wait Until Location Is
    ...    ${BASE_URL}${path}
    ...    20s

    Wait Until Page Contains
    ...    ${expected_text}
    ...    20s
