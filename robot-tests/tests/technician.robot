
*** Settings ***
Documentation    AV Cooling System Technician Tests
Library          SeleniumLibrary
Library          OperatingSystem
Test Setup       Open Browser    ${BASE_URL}    ${BROWSER}
Test Teardown    Close Browser

*** Variables ***
${BASE_URL}      http://localhost:5173
${BROWSER}       chrome

*** Test Cases ***
01 - Technician Dashboard
    Login As Technician
    Check Technician Page    /management/dashboard

02 - Technician Appointment Calendar
    Login As Technician
    Go To    ${BASE_URL}/management/booking-calendar

    Wait Until Location Is
    ...    ${BASE_URL}/management/booking-calendar
    ...    20s

    Wait Until Page Contains Element
    ...    css:.booking-picker__grid
    ...    20s

    Page Should Not Contain    Your unavailable day/time
    Page Should Not Contain    No jobs or unavailable periods

03 - Technician Availability
    Login As Technician

    Go To    ${BASE_URL}/management/schedules

    Wait Until Location Is
    ...    ${BASE_URL}/management/schedules
    ...    20s

    Wait Until Page Contains
    ...    Technician Availability
    ...    20s

04 - Technician Capacity Calculator
    Login As Technician

    Go To    ${BASE_URL}/management/capacity-calculator

    Wait Until Location Is
    ...    ${BASE_URL}/management/capacity-calculator
    ...    20s

    Wait Until Page Contains
    ...    Aircon Capacity Calculator
    ...    20s

05 - Kurt And JB Have Separate Appointments
    ${kurt_email}=    Get Environment Variable    KURT_EMAIL    ${EMPTY}
    ${kurt_password}=    Get Environment Variable    KURT_PASSWORD    ${EMPTY}
    ${jb_email}=    Get Environment Variable    JB_EMAIL    ${EMPTY}
    ${jb_password}=    Get Environment Variable    JB_PASSWORD    ${EMPTY}
    ${date}=    Get Environment Variable    TEST_JOB_DATE    ${EMPTY}
    ${kurt_job}=    Get Environment Variable    KURT_ONLY_REFERENCE    ${EMPTY}
    ${jb_job}=    Get Environment Variable    JB_ONLY_REFERENCE    ${EMPTY}

    Skip If
    ...    not all([$kurt_email, $kurt_password, $jb_email, $jb_password, $date, $kurt_job, $jb_job])
    ...    Set both technician accounts and same-day test job references first.

    Login With Credentials    ${kurt_email}    ${kurt_password}
    Open Appointment Date    ${date}

    Wait Until Page Contains    ${kurt_job}    20s
    Page Should Not Contain    ${jb_job}

    Close Browser
    Open Browser    ${BASE_URL}    ${BROWSER}

    Login With Credentials    ${jb_email}    ${jb_password}
    Open Appointment Date    ${date}

    Wait Until Page Contains    ${jb_job}    20s
    Page Should Not Contain    ${kurt_job}

*** Keywords ***
Login As Technician
    ${email}=    Get Environment Variable    TECHNICIAN_EMAIL    ${EMPTY}
    ${password}=    Get Environment Variable    TECHNICIAN_PASSWORD    ${EMPTY}

    Skip If    not $email or not $password
    ...    Set TECHNICIAN_EMAIL and TECHNICIAN_PASSWORD first.

    Login With Credentials    ${email}    ${password}

Login With Credentials
    [Arguments]    ${email}    ${password}

    Go To    ${BASE_URL}/management/login

    Wait Until Element Is Visible
    ...    css:input[type="email"]
    ...    15s

    Input Text        css:input[type="email"]       ${email}
    Input Password    css:input[type="password"]    ${password}

    Click Button    css:button[type="submit"]

    Wait Until Location Is
    ...    ${BASE_URL}/management/dashboard
    ...    20s

Check Technician Page
    [Arguments]    ${path}

    Go To    ${BASE_URL}${path}

    Wait Until Location Is
    ...    ${BASE_URL}${path}
    ...    20s

    Wait Until Page Contains Element
    ...    css:.mgmt-main
    ...    15s

Open Appointment Date
    [Arguments]    ${date}

    Go To    ${BASE_URL}/management/booking-calendar

    Wait Until Page Contains Element
    ...    css:.booking-picker__grid
    ...    20s

    Click Element
    ...    css:button[aria-label^="${date}"]
