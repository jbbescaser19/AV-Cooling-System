
*** Settings ***
Documentation    AV Cooling System Ecommerce Tests
Library          SeleniumLibrary
Library          OperatingSystem
Test Setup       Open Browser    ${BASE_URL}    ${BROWSER}
Test Teardown    Close Browser

*** Variables ***
${BASE_URL}      http://localhost:5173
${BROWSER}       chrome

*** Test Cases ***
01 - Homepage
    Go To    ${BASE_URL}/
    Wait Until Page Contains    AV Cooling    15s

02 - Shop
    Check Public Page    /shop    Air-conditioning catalog

03 - Services
    Check Public Page    /services    Professional aircon service

04 - About Us
    Check Public Page    /about    AV Cooling System

05 - Contact Us
    Go To    ${BASE_URL}/contact
    Wait Until Location Is    ${BASE_URL}/contact    15s
    Page Should Contain Element    css:main

06 - Customer Reviews
    Check Public Page    /reviews    Real customer experiences

07 - Shopping Cart
    Check Public Page    /cart    Your cart

08 - Customer Login
    Check Public Page    /login    Welcome back
    Page Should Contain Element    css:input[type="password"]

09 - Customer Registration
    Check Public Page    /register    Create account

10 - Forgot Password
    Check Public Page    /forgot-password    Forgot your password?

11 - Checkout Requires Login
    Go To    ${BASE_URL}/checkout
    Wait Until Location Is    ${BASE_URL}/login    20s

12 - Customer Account Pages
    Login As Customer
    Check Customer Page    /account/profile
    Check Customer Page    /account/orders
    Check Customer Page    /account/services
    Check Customer Page    /account/payments
    Check Customer Page    /account/notifications
    Check Customer Page    /account/feedback
    Check Customer Page    /account/addresses
    Check Customer Page    /account/change-password

13 - Customer Capacity Calculator
    Login As Customer
    Go To    ${BASE_URL}/account/capacity-calculator
    Wait Until Location Is
    ...    ${BASE_URL}/account/capacity-calculator
    ...    20s
    Wait Until Page Contains    Aircon Capacity Calculator    15s

*** Keywords ***
Check Public Page
    [Arguments]    ${path}    ${expected_text}
    Go To    ${BASE_URL}${path}
    Wait Until Location Is    ${BASE_URL}${path}    15s
    Wait Until Page Contains    ${expected_text}    15s

Login As Customer
    ${email}=    Get Environment Variable    CUSTOMER_EMAIL    ${EMPTY}
    ${password}=    Get Environment Variable    CUSTOMER_PASSWORD    ${EMPTY}
    Skip If    not $email or not $password
    ...    Set CUSTOMER_EMAIL and CUSTOMER_PASSWORD first.

    Go To    ${BASE_URL}/login
    Wait Until Element Is Visible
    ...    css:input[name="email"]
    ...    15s

    Input Text        css:input[name="email"]       ${email}
    Input Password    css:input[name="password"]    ${password}
    Click Button      css:button[type="submit"]

    Wait Until Keyword Succeeds
    ...    20s
    ...    1s
    ...    Page Should Not Contain Element
    ...    css:.auth-login-page

Check Customer Page
    [Arguments]    ${path}
    Go To    ${BASE_URL}${path}
    Wait Until Location Is    ${BASE_URL}${path}    20s
    Wait Until Page Contains Element    css:main    15s
