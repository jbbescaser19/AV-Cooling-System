
*** Settings ***
Documentation    Basic automated tests for AV Cooling System
Library          SeleniumLibrary
Test Setup       Open Browser    ${BASE_URL}    ${BROWSER}
Test Teardown    Close Browser

*** Variables ***
${BASE_URL}      http://localhost:5173
${BROWSER}       chrome

*** Test Cases ***
01 - Homepage Loads Successfully
    [Documentation]    Check if the AV Cooling homepage loads.
    Wait Until Page Contains    AV Cooling    15s
    Page Should Contain Element    css:body

02 - Shop Page Opens
    [Documentation]    Check if customers can visit the shop.
    Go To    ${BASE_URL}/shop
    Wait Until Page Contains    Shop    15s
    Location Should Be    ${BASE_URL}/shop

03 - Services Page Opens
    [Documentation]    Check if the services page loads.
    Go To    ${BASE_URL}/services
    Wait Until Page Contains Element    css:main    15s
    Location Should Be    ${BASE_URL}/services

04 - Management Login Opens
    [Documentation]    Check if the staff login page loads.
    Go To    ${BASE_URL}/management/login
    Wait Until Page Contains Element    css:input[type="password"]    15s
    Page Should Contain Element    css:button[type="submit"]
