sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"dispatchcreation/test/integration/pages/VIM_PO_HEADERSList",
	"dispatchcreation/test/integration/pages/VIM_PO_HEADERSObjectPage"
], function (JourneyRunner, VIM_PO_HEADERSList, VIM_PO_HEADERSObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('dispatchcreation') + '/test/flp.html#app-preview',
        pages: {
			onTheVIM_PO_HEADERSList: VIM_PO_HEADERSList,
			onTheVIM_PO_HEADERSObjectPage: VIM_PO_HEADERSObjectPage
        },
        async: true
    });

    return runner;
});

