sap.ui.define([
    "sap/ui/test/opaQunit",
    "./pages/JourneyRunner"
], function (opaTest, runner) {
    "use strict";

    function journey() {
        QUnit.module("First journey");

        opaTest("Start application", function (Given, When, Then) {
            Given.iStartMyApp();

            Then.onTheVIM_PO_HEADERSList.iSeeThisPage();

        });


        opaTest("Navigate to ObjectPage", function (Given, When, Then) {
            // Note: this test will fail if the ListReport page doesn't show any data
            
            When.onTheVIM_PO_HEADERSList.onFilterBar().iExecuteSearch();
            
            Then.onTheVIM_PO_HEADERSList.onTable().iCheckRows();

            When.onTheVIM_PO_HEADERSList.onTable().iPressRow(0);
            Then.onTheVIM_PO_HEADERSObjectPage.iSeeThisPage();

        });

        opaTest("Teardown", function (Given, When, Then) { 
            // Cleanup
            Given.iTearDownMyApp();
        });
    }

    runner.run([journey]);
});