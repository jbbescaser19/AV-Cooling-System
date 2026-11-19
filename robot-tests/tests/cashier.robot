
*** Settings ***
Documentation    Cashier login and role navigation tests
Library          SeleniumLibrary
Test Setup       Open Browser    ${BASE_URL}    chrome
Test Teardown    Close Browser

*** Variables ***
${BASE_URL}      http://localhost:5173

*** Test Cases ***
Cashier Can Login And Access POS
    [Documentation]    Verify Cashier can access only POS and Calculator.

    Go To    ${BASE_URL}/management/login

    Wait Until Element Is Visible
    ...    css:input[type="password"]
    ...    15s

    Input Text
    ...    css:input[type="email"]
    ...    %{CASHIER_EMAIL}

    Input Password
    ...    css:input[type="password"]
    ...    %{CASHIER_PASSWORD}

    Click Button    css:button[type="submit"]

    Wait Until Location Contains    /management/pos    20s

    # Wait for React to finish rendering the sidebar.
    Wait Until Page Contains Element
    ...    css:a[href="/management/pos"]
    ...    20s

    Wait Until Page Contains Element
    ...    css:a[href="/management/capacity-calculator"]
    ...    20s

    # Cashier must not see restricted sidebar pages.
    Page Should Not Contain Element
    ...    css:a[href="/management/dashboard"]

    Page Should Not Contain Element
    ...    css:a[href="/management/orders"]

    Page Should Not Contain Element
    ...    css:a[href="/management/payments"]

    Page Should Not Contain Element
    ...    css:a[href="/management/inventory"]

    Page Should Not Contain Element
    ...    css:a[href="/management/booking-calendar"]

    Log    Cashier sidebar contains POS and Calculator only.
