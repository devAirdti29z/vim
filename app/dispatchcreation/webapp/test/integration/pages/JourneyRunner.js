sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"dispatchcreation/test/integration/pages/POHeadersList",
	"dispatchcreation/test/integration/pages/POHeadersObjectPage"
], function (JourneyRunner, POHeadersList, POHeadersObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('dispatchcreation') + '/test/flp.html#app-preview',
        pages: {
			onThePOHeadersList: POHeadersList,
			onThePOHeadersObjectPage: POHeadersObjectPage
        },
        async: true
    });

    return runner;
});

