
*** Settings ***
Documentation    AV Cooling System Page Access Tests
Library          SeleniumLibrary
Library          OperatingSystem
Test Setup       Open Browser    ${BASE_URL}    ${BROWSER}
Test Teardown    Close Browser

*** Variables ***
${BASE_URL}      http://localhost:5173
${BROWSER}       chrome

*** Test Cases ***
01 - Guest Cannot Access Customer Orders
    Go To    ${BASE_URL}/account/orders

    Wait Until Location Is
    ...    ${BASE_URL}/login
    ...    20s

02 - Guest Cannot Access Checkout
    Go To    ${BASE_URL}/checkout

    Wait Until Location Is
    ...    ${BASE_URL}/login
    ...    20s

03 - Guest Cannot Access Management
    Go To    ${BASE_URL}/management/orders

    Wait Until Location Is
    ...    ${BASE_URL}/management/login
    ...    20s

04 - Cashier Sidebar Contains Only Two Pages
    Login As Cashier

    Wait Until Page Contains Element
    ...    css:a[href="/management/pos"]
    ...    20s

    Wait Until Page Contains Element
    ...    css:a[href="/management/capacity-calculator"]
    ...    20s

    ${links}=    Get WebElements    css:.mgmt-sidebar nav a

    Length Should Be    ${links}    2

    Page Should Not Contain Element
    ...    css:a[href="/management/dashboard"]

    Page Should Not Contain Element
    ...    css:a[href="/management/orders"]

    Page Should Not Contain Element
    ...    css:a[href="/management/payments"]

05 - Cashier Cannot Open Restricted Management Pages
    Login As Cashier

    FOR    ${path}    IN
    ...    /management/dashboard
    ...    /management/orders
    ...    /management/payments
    ...    /management/inventory
    ...    /management/service-requests
    ...    /management/booking-calendar
    ...    /management/staff
        Go To    ${BASE_URL}${path}

        Wait Until Location Is
        ...    ${BASE_URL}/management/pos
        ...    20s
    END

06 - Cashier Can Open Calculator
    Login As Cashier

    Go To    ${BASE_URL}/management/capacity-calculator

    Wait Until Location Is
    ...    ${BASE_URL}/management/capacity-calculator
    ...    20s

    Wait Until Page Contains
    ...    Aircon Capacity Calculator
    ...    20s

07 - Technician Cannot Open Orders And Payments
    ${email}=    Get Environment Variable    TECHNICIAN_EMAIL    ${EMPTY}
    ${password}=    Get Environment Variable    TECHNICIAN_PASSWORD    ${EMPTY}

    Skip If    not $email or not $password
    ...    Set TECHNICIAN_EMAIL and TECHNICIAN_PASSWORD first.

    Login With Credentials    ${email}    ${password}

    Go To    ${BASE_URL}/management/orders

    Wait Until Location Is
    ...    ${BASE_URL}/management/dashboard
    ...    20s

    Go To    ${BASE_URL}/management/payments

    Wait Until Location Is
    ...    ${BASE_URL}/management/dashboard
    ...    20s

*** Keywords ***
Login As Cashier
    ${email}=    Get Environment Variable    CASHIER_EMAIL    ${EMPTY}
    ${password}=    Get Environment Variable    CASHIER_PASSWORD    ${EMPTY}

    Skip If    not $email or not $password
    ...    Set CASHIER_EMAIL and CASHIER_PASSWORD first.

    Login With Credentials    ${email}    ${password}

    Wait Until Location Is
    ...    ${BASE_URL}/management/pos
    ...    20s

Login With Credentials
    [Arguments]    ${email}    ${password}

    Go To    ${BASE_URL}/management/login

    Wait Until Element Is Visible
    ...    css:input[type="email"]
    ...    15s

    Input Text        css:input[type="email"]       ${email}
    Input Password    css:input[type="password"]    ${password}

    Click Button    css:button[type="submit"]
